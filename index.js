const { readFileSync } = require( 'fs' );
const { writeFileSync } = require( 'fs' );
const { resolve: resolvePath } = require( 'path' );
const { dirname } = require( 'path' );
const { parse } = require( '@babel/parser' );
const { default: traverse } = require( '@babel/traverse' );
const { default: generate } = require( '@babel/generator' );
const { isImportDeclaration } = require( '@babel/types' );
const { isExportDeclaration } = require( '@babel/types' );

const [ , , input, output ] = process.argv;
const cwd = process.cwd();
const inputPath = resolvePath( cwd, input );
const outputPath = resolvePath( cwd, output );
const modules = processModule( inputPath );
const deduplicatedModules = new Map( modules );
const bundleContent = [ ...deduplicatedModules.values() ].join( '\n' );

writeFileSync( outputPath, bundleContent, 'utf8' );

function processModule( path ) {
	const dir = dirname( path );
	const code = readFileSync( path, 'utf8' );
	const modules = [];

	const ast = parse( code, {
		sourceType: 'module'
	} );

	traverse( ast, {
		enter( path ) {
			if ( isExportDeclaration( path.node ) ) {
				return path.remove();
			}

			if ( !isImportDeclaration( path.node ) ) {
				return;
			}

			const depPath = resolvePath( dir, path.node.source.value );
			modules.push( ...processModule( depPath ) );

			path.remove();
		}
	} );

	const { code: transformedCode } = generate( ast );

	modules.push( [ path, transformedCode ] );

	return modules;
}
