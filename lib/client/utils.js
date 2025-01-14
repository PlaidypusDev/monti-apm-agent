getBrowserInfo = function () {
  return {
    browser: window.navigator.userAgent,
    userId: Meteor.userId && Meteor.userId(),
    url: location.href,
    resolution: getResolution()
  };
}

getResolution = function () {
  if(screen && screen.width && screen.height) {
    var resolution = screen.width + 'x' + screen.height;
    return resolution;
  }
}

const toArray = (...args) => args;

getErrorStack = function (zone, callback) {
  var trace = [];
  var eventMap = zone.eventMap || {};
  var infoMap = zone.infoMap || {};

  trace.push({
    at: (new Date().getTime()),
    stack: zone.erroredStack.get()
  });

  processZone();
  function processZone() {
    // we assume, first two zones are not interesting
    // bacause, they are some internal meteor loading stuffs
    if(zone && zone.depth > 2) {
      var stack = "";
      if(zone.currentStack) {
        stack = zone.currentStack.get();
      }

      var events = eventMap[zone.id] || [];
      var info = getInfoArray(infoMap[zone.id]);
      var ownerArgsEvent = events && events[0] && events[0].type == 'owner-args' && events.shift();
      var runAt = (ownerArgsEvent)? ownerArgsEvent.at : zone.runAt;
      var ownerArgs = (ownerArgsEvent)? toArray.apply(null, ownerArgsEvent.args) : [];

      // limiting
      events = events.slice(-5).map(checkSizeAndPickFields(100));
      info = info.slice(-5).map(checkSizeAndPickFields(100));
      ownerArgs = checkSizeAndPickFields(200)(ownerArgs.slice(0,5));

      zone.owner && delete zone.owner.zoneId;

      trace.push({
        createdAt: zone.createdAt,
        runAt: runAt,
        stack: stack,
        owner: zone.owner,
        ownerArgs: ownerArgs,
        events: events,
        info: info,
        zoneId: zone.id
      });
      zone = zone.parent;

      setTimeout(processZone, 0);
    } else {
      callback(trace);
    }
  }
}

getInfoArray = function (info = {}) {
  return Object.keys(info)
    .map(function (key, type) {
      const value = info[key];
      value.type = type;
      return value;
    });
}

getTime = function () {
  if(Kadira && Kadira.syncedDate) {
    return Kadira.syncedDate.getTime();
  } else {
    return (new Date().getTime());
  }
}

getClientArch = function () {
  if (Meteor.isCordova) {
    return 'cordova.web';
  } else if (typeof Meteor.isModern === 'undefined' || Meteor.isModern) {
    return 'web.browser'
  } else {
    return 'web.browser.legacy'
  }
}

checkSizeAndPickFields = function(maxFieldSize) {
  return function(obj) {
    maxFieldSize = maxFieldSize || 100;
    for(var key in obj) {
      var value = obj[key];
      try {
        var valueStringified = JSON.stringify(value);
        if(valueStringified.length > maxFieldSize) {
          obj[key] = valueStringified.substr(0, maxFieldSize) + " ...";
        } else {
          obj[key] = value;
        }
      } catch(ex) {
        obj[key] = 'Error: cannot stringify value';
      }
    }
    return obj;
  }
}

httpRequest = function (method, url, options, callback) {
  /**
   * IE8 and IE9 does not support CORS with the usual XMLHttpRequest object
   * If XDomainRequest exists, use it to send errors.
   * XDR can POST data to HTTPS endpoints only if current page uses HTTPS
   */
  if (window.XDomainRequest) {
    var xdr = new XDomainRequest();
    url = matchPageProtocol(url);

    xdr.onload = function () {
      var headers = { 'Content-Type': xdr.contentType };
      var data = {};
      try {
        data = JSON.parse(content);
      } catch (e) {}

      callback(null, { content: xdr.responseText, data: data, headers: headers, statusCode: 200 });
    }

    xdr.onerror = function () {
      callback({ statusCode: 404 });
    }

    xdr.open(method, url);
    xdr.send(options.content || null);

    function matchPageProtocol (endpoint) {
      var withoutProtocol = endpoint.substr(endpoint.indexOf(':') + 1);
      return window.location.protocol + withoutProtocol;
    }
  } else {
    HTTP.call(method, url, options, callback);
  }
};
