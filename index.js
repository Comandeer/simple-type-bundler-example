const { readFileSync } = require( 'fs' );
const { writeFileSync } = require( 'fs' );
const { resolve: resolvePath } = require( 'path' );
const { dirname } = require( 'path' );
const { parse } = require( '@babel/parser' );
const { default: traverse } = require( '@babel/traverse' );
const { default: generate } = require( '@babel/generator' );
const { isImportDeclaration } = require( '@babel/types' );
const { isExportDeclaration } = require( '@babel/types' );
const { exportNamedDeclaration } = require( '@babel/types' );

const [ , , input, output ] = process.argv;
const cwd = process.cwd();
const inputPath = resolvePath( cwd, input );
const outputPath = resolvePath( cwd, output );
const modules = processModule( inputPath, true );
const deduplicatedModules = new Map( modules );
const bundleContent = [ ...deduplicatedModules.values() ].join( '\n' );

writeFileSync( outputPath, bundleContent, 'utf8' );

function processModule( path, isMain = false ) {
	const dir = dirname( path );
	const code = readFileSync( path, 'utf8' );
	const modules = [];

	const ast = parse( code, {
		sourceType: 'module',
		plugins: [
			[
				'typescript',
				{
					dts: true
				}
			]
		]
	} );

	traverse( ast, {
		enter( path ) {
			if ( isExportDeclaration( path.node ) ) {
				return handleExport( path, {
					isMain,
					dir,
					modules
				} );
			}

			if ( !isImportDeclaration( path.node ) ) {
				return;
			}

			processImport( path.node, dir, modules );

			path.remove();
		}
	} );

	const { code: transformedCode } = generate( ast );

	modules.push( [ path, transformedCode ] );

	return modules;
}

function handleExport( path, { isMain, dir, modules } ) {
	const node = path.node;

	if ( node.source ) {
		processImport( node, dir, modules );
	}

	if ( isMain && node.source ) {
		path.replaceWith( exportNamedDeclaration( node.declaration, node.specifiers ) );

		return;
	}

	if ( isMain ) {
		return;
	}

	if ( node.declaration ) {
		path.replaceWith( node.declaration );

		return;
	}

	path.remove();
}

function processImport( node, dir, modules ) {
	const importRelativePath = createFilePath( node.source.value );
	const depPath = resolvePath( dir, importRelativePath );

	modules.push( ...processModule( depPath ) );
}

function createFilePath( importSpecifier ) {
	if ( !importSpecifier.endsWith( '.d.ts' ) ) {
		return `${ importSpecifier }.d.ts`;
	}

	return importSpecifier;
}