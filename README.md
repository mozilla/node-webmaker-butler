node-webmaker-butler
====================

Serving Webmaker node apps without making a mess!

The Webmaker Butler makes it easy to turn your Webmaker node.js app into a clustered, domain
wrapped app that will report errors to loggins.  It provides a command-line tool (`butler`)
for starting clustered apps, and middleware functions for dealing with domains and errors.

## Usage

Using the Webmaker Butler is a two-part process.

### 1. Setup the middleware

We have to give butler the information about our graylog2 server (`host`), our app's name
in loggins (`facility`), and optionally, a function to run when a domain crashes (`onCrash`):

```javascript
...
// setup Express app as usual. Here we show a snippet of an app
// that uses nunjucks to render error pages to the user.
var server;
...
nunjucksEnv.express( app );
app.disable( "x-powered-by" );

// Setup butler, with host (graylog2 host) and facility (e.g., app name in loggins)
var butler = require( "webmaker-butler" )({
  host: env.get( "GRAYLOG_HOST" ),
  facility: env.get( "GRAYLOG_FACILITY" ),
  onCrash: function( err, req, res ) {
    // When a domain crashes (unrecoverable error), we close down the server
    // on this fork so no more requests come in, and attempt to render an
    // error page.
    server.close();
    res.statusCode = 500;
    res.render( 'error.html', { message: err.message, code: err.status });
  }
});
app.use( butler.middlware );
...
// For non-fatal crashes (i.e., things that get caught in Express error-handling
// middleware), and which won't kill the domain (i.e., trigger `onCrash`),
// report to loggins using `reportError`.
app.use( function( err, req, res, next) {
  if ( !err.status ) {
    err.status = 500;
  }
  butler.reportError( err );
  res.status( err.status );
  res.render( 'error.html', { message: err.message, code: err.status });
});
...
// Keep a reference to the server, so we can close it on domain crashes.
server = app.listen( env.get( "PORT" ), function() {
  console.log( "Server listening ( http://localhost:%d )", env.get( "PORT" ));
});
```

### 2. Run the app with butler

Starting multiple instances of your app in a cluster is made trivial using the `butler`
command-line tool:

```bash
$ node ./node_modules/butler
```

You can configure various aspects of how the butler runs your app:

```bash
Start a clustered Webmaker node.js app.
Usage: node ./bin/index.js

Options:
  --app      Name of the node.js app to start                             [default: "app.js"]
  --forks    Number of forks to create                                    [default: 2]
  --restart  Whether to restart failed forks on error (defaults to true)  [default: true]
```
