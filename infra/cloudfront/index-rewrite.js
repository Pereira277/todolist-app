// CloudFront default root object only applies to the "/" path, so any other
// directory-style URL (e.g. "/signup/") would otherwise fall through to the
// S3 origin as a path with no object. Rewrite it to the matching index.html.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  } else if (!uri.split('/').pop().includes('.')) {
    request.uri += '/index.html';
  }
  return request;
}
