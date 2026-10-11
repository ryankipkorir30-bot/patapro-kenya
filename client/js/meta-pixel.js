(function () {
  "use strict";

  // Replace this with consent management before production
  // if visitor consent is required.
  if (window.__pataProPixelLoaded) return;
  window.__pataProPixelLoaded = true;

  !function(f,b,e,v,n,t,s) {
    if(f.fbq)return;
    n=f.fbq=function() {
      n.callMethod
        ? n.callMethod.apply(n,arguments)
        : n.queue.push(arguments);
    };
    if(!f._fbq)f._fbq=n;
    n.push=n;
    n.loaded=true;
    n.version='2.0';
    n.queue=[];
    t=b.createElement(e);
    t.async=true;
    t.src=v;
    s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s);
  }(window,document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq('init', '1585087459546373');
  window.fbq('track', 'PageView');
})();
