var cluster = require( 'cluster' ),
  fs = require( 'fs' ),
  optimist = require( 'optimist' ),
  cpuCount = require( 'os' ).cpus().length,
  argv = optimist.usage( 'Start a clustered Webmaker node.js app.\nUsage: $0', {
    'app': {
      description: 'Name of the node.js app to start',
      default: 'app.js',
      required: false,
      short: 'a'
    },
    'forks': {
      description: 'Number of forks to create',
      require: false,
      default: 2,
      short: 'f'
    },
    'restart': {
      description: 'Whether to restart failed forks on error (defaults to true)',
      boolean: true,
      required: false,
      default: true,
      short: 'r'
    }
  }).argv;

function fileExists(filename) {
  try {
    return ( fs.statSync( filename ) ).isFile();
  } catch ( e ) {
    return false;
  }
}

if ( !fileExists( argv.app ) ) {
  console.error( '[webmaker-butler] Error: unable to open `' + argv.app + '`' );
  process.exit( 1 );
}

if ( argv.forks > cpuCount ) {
  console.warn( '[webmaker-butler] Warning: forks greater than available CPUs, reducing to ' + cpuCount );
  argv.forks = cpuCount;
}

// Only (re)fork if we're a) starting up; or b) had a worker get to
// 'listening'. Don't fork in an endless loop if the process is bad.
function fork() {
  console.log( '[webmaker-butler] Info: Starting server worker...' );
  cluster.fork().on( 'listening', function() {
    console.log( '[webmaker-butler] Info: Server worker started.' );
  });
}

cluster.setupMaster({ exec: argv.app });
cluster.on( 'exit', function( worker, code, signal ) {
  console.error( '[webmaker-butler] Error: Server worker %s exited.', worker.id );

  // Restart server worker only if we've been configured that way.
  if ( argv.restart ) {
    fork();
  }

  // If there are no more workers running, shut down cluster process.
  if ( !Object.keys( cluster.workers ).length ) {
    console.error( '[webmaker-butler] Error: No more server workers running, shutting down.' );
    process.exit( 1 );
  }
});

while( forks-- ) {
  fork();
}
