const { PaymentRequest } = require('@cashu/cashu-ts');
console.log('PaymentRequest keys:', Object.keys(PaymentRequest));
console.log('PaymentRequest prototype keys:', Object.getOwnPropertyNames(PaymentRequest.prototype));
console.log('fromEncodedRequest implementation:', PaymentRequest.fromEncodedRequest.toString());

const pr = new PaymentRequest(
  [{ type: 'nostr', target: 'test', tags: [['n', '17']] }],
  'test-id',
  100,
  'sat',
  ['https://mint.host/'],
  'test-memo'
);

const encoded = pr.toEncodedRequest();
console.log('Encoded request:', encoded);
console.log('Decoded again:', PaymentRequest.fromEncodedRequest(encoded));
