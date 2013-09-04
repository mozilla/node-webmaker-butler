var domain = require( 'domain' ),
    cluster = require( 'cluster' ),
    path = require( 'path' );

module.exports = function( options ) {
  options = options || {};

  // In order for crashes/errors to be usefully logged, we need GRAYLOG settings.
  if ( !options.host || !options.facility ) {
    console.warn( '[webmaker-butler] Missing GRAYLOG host and/or facility options.' );
    throw new Error( msg );
  }

  if ( options.host ) {
    GLOBAL.graylogHost = options.host;
  }
  if ( options.facility ) {
    GLOBAL.graylogFacility = options.facility;
  }

  // Use user-supplied error handler, or supply a default one to give a simple 500
  function defaultCrashHandler( err, req, res ) {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain');
    res.end('An error occurred.\n');
  }
  var onCrash = options.onCrash || defaultCrashHandler;

  require("graylog");

  function getVersion() {
    try {
      return require( path.join( __dirname, '..', '..', 'package.json' ) ).version;
    } catch( e ) {
      return 'Unknown';
    }
  }

  function reportError( error, isFatal ) {
    if ( !graylogHost ) {
      return;
    }
    log( "[" + ( isFatal ? "CRASH" : "ERROR" ) + "]" + error.message,
         error.message,
         {
           level: isFatal ? LOG_CRIT : LOG_ERR,
           stack: error.stack,
           _serverVersion: getVersion(),
           _fullStack: error.stack || 'No Stack'
         }
    );
  }

  return {

    middleware:  function( req, res, next ) {
      var guard = domain.create();
      guard.add( req );
      guard.add( res );

      guard.on( 'error', function( err ) {
        console.error( '[webmaker-butler] Error:', err.message );
        try {
          // make sure we close down within 30 seconds
          var killtimer = setTimeout( function() {
            process.exit( 1 );
          }, 30000);
          // But don't keep the process open just for that!
          killtimer.unref();

          reportError( err, true );

          if ( cluster.worker ) {
            cluster.worker.disconnect();
          }

          // Do any error clean up before this domain dies (e.g., server.close()),
          // render some HTML for the user, etc.
          onCrash( err, req, res );

          guard.dispose();
          process.exit( 1 );
        } catch( err2 ) {
          console.error( '[webmaker-butler] Error: unable to send 500', err2.message );
        }
      });

      guard.run( next );
    },

    reportError: reportError

  };
};
