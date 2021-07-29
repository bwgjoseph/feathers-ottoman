##  0.3.1 (July 29, 2021)

##### Chores

*  update README ([a4de57c1](https://github.com/bwgjoseph/feathers-ottoman/commit/a4de57c1b030eee042093fe5ed64f8e9fae26871))

##### Bug Fixes

*  _getQuery do not use this.id ([af1dd954](https://github.com/bwgjoseph/feathers-ottoman/commit/af1dd954b49bd99e6f87d0b0776fce7026d39766))

##  0.3.0 (July 17, 2021)

##### Build System / Dependencies

*  upgrade dependencies ([6e46332a](https://github.com/bwgjoseph/feathers-ottoman/commit/6e46332ab6e9b6390feef7f81bad2482a9df6013))

##### Refactors

*  _mapQueryOperator to parse $in, $nin correctly ([a2fa6122](https://github.com/bwgjoseph/feathers-ottoman/commit/a2fa61222f3f498c61b619fb92554536b91dba68))

##  0.2.0 (June 30, 2021)

##### Build System / Dependencies

*  upgrade dependencies ([28dd4c49](https://github.com/bwgjoseph/feathers-ottoman/commit/28dd4c4968dadfc067fc292e9cde57a665f9f119))
*  upgrade dependencies ([550cc740](https://github.com/bwgjoseph/feathers-ottoman/commit/550cc74076fa608b4f6050459a17261b3aafab7c))
*  upgrade dependencies ([cb119743](https://github.com/bwgjoseph/feathers-ottoman/commit/cb1197437f72896c5bbb6cd207e65d0cb93f155e))

##### Chores

*  update README ([3f5e9c27](https://github.com/bwgjoseph/feathers-ottoman/commit/3f5e9c279ae3397138adfc8db8ec000d55ee9fe2))

##### New Features

*  support $ignoreCase filters in Find ([dbdf0082](https://github.com/bwgjoseph/feathers-ottoman/commit/dbdf008282e45dde5eab6dd642fed2c0142076c1))

##### Bug Fixes

*  handle query ById + ottoman operator ($ne, $in) ([7e12ac1c](https://github.com/bwgjoseph/feathers-ottoman/commit/7e12ac1c4117ae0321eafb713995735ecc13e835))
*  operator not mapped for multi-operation ([98cdc14e](https://github.com/bwgjoseph/feathers-ottoman/commit/98cdc14e662a49564a0b0092fdc825ac45d63af4))

##### Performance Improvements

*  remove redundant call to _select on multi patch ([23d23057](https://github.com/bwgjoseph/feathers-ottoman/commit/23d23057fae2ebe445d361e762f1694fe2a8186f))
*  use Promise.all on _find ([14565408](https://github.com/bwgjoseph/feathers-ottoman/commit/14565408169d4bd8b24249113198908713093980))

##### Refactors

*  switch import for ModelOptions ([4240da75](https://github.com/bwgjoseph/feathers-ottoman/commit/4240da758fa273aa3b91bb5fbf8c6098ee6485c2))

##### Tests

*  declare type OttomanServiceOptions for options ([076488f4](https://github.com/bwgjoseph/feathers-ottoman/commit/076488f456a004d8c0e6360a7c16e0ecad9d75eb))
*  add test case for all Comparison Operators ([63a8ce5b](https://github.com/bwgjoseph/feathers-ottoman/commit/63a8ce5b38b22b211243142072a9a4532cc50b97))

##  0.1.0 (June 4, 2021)

Initial Release