/**
 * Module dependencies.
 * @ignore
 */
var BinaryParser = require('./binary_parser').BinaryParser;

/**
 * Machine id.
 *
 * Create a random 3-byte value (i.e. unique for this
 * process). Other drivers use a md5 of the machine id here, but
 * that would mean an asyc call to gethostname, so we don't bother.
 * @ignore
 */
var MACHINE_ID = parseInt(Math.random() * 0xFFFFFF, 10);

// Regular expression that checks for hex value
var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$");

/**
* Create a new ObjectID instance
*
* @class
* @param {(string|number)} id Can be a 24 byte hex string, 12 byte binary string or a Number.
* @property {number} generationTime The generation time of this ObjectId instance
* @return {ObjectID} instance of ObjectID.
*/
var ObjectID = function ObjectID(id) {
  // Duck-typing to support ObjectId from different npm packages
  if(id instanceof ObjectID) return id;
  if(!(this instanceof ObjectID)) return new ObjectID(id);

  this._bsontype = 'ObjectID';

  var __id = null;
  var valid = ObjectID.isValid(id);

  // Throw an error if it's not a valid setup
  if(!valid && id != null){
    throw new Error("Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");
  } else if(valid && typeof id == 'string' && id.length == 24) {
    return ObjectID.createFromHexString(id);
  } else if(id == null || typeof id == 'number') {
    // convert to 12 byte binary string
    this.id = this.generate(id);
  } else if(id != null && id.length === 12) {
    // assume 12 byte string
    this.id = id;
  } else if(id != null && id.toHexString) {
    // Duck-typing to support ObjectId from different npm packages
    return id;
  }

  if(ObjectID.cacheHexString) this.__id = this.toHexString();
};

// Allow usage of ObjectId as well as ObjectID
var ObjectId = ObjectID;

// Precomputed hex table enables speedy hex string conversion
var hexTable = [];
for (var i = 0; i < 256; i++) {
  hexTable[i] = (i <= 15 ? '0' : '') + i.toString(16);
}

/**
* Return the ObjectID id as a 24 byte hex string representation
*
* @method
* @return {string} return the 24 byte hex string representation.
*/
ObjectID.prototype.toHexString = function() {
  if(ObjectID.cacheHexString && this.__id) return this.__id;

  var hexString = '';

  if(this.id instanceof _Buffer) {
    hexString = convertToHex(this.id);
    if(ObjectID.cacheHexString) this.__id = hexString;
    return hexString;
  }

  for (var i = 0; i < this.id.length; i++) {
    hexString += hexTable[this.id.charCodeAt(i)];
  }

  if(ObjectID.cacheHexString) this.__id = hexString;
  return hexString;
};

/**
* Update the ObjectID index used in generating new ObjectID's on the driver
*
* @method
* @return {number} returns next index value.
* @ignore
*/
ObjectID.prototype.get_inc = function() {
  return ObjectID.index = (ObjectID.index + 1) % 0xFFFFFF;
};

/**
* Update the ObjectID index used in generating new ObjectID's on the driver
*
* @method
* @return {number} returns next index value.
* @ignore
*/
ObjectID.prototype.getInc = function() {
  return this.get_inc();
};

/**
* Generate a 12 byte id string used in ObjectID's
*
* @method
* @param {number} [time] optional parameter allowing to pass in a second based timestamp.
* @return {string} return the 12 byte id binary string.
*/
ObjectID.prototype.generate = function(time) {
  if ('number' != typeof time) {
    time = ~~(Date.now()/1000);
  }

  var time4Bytes = BinaryParser.encodeInt(time, 32, true, true);
  /* for time-based ObjectID the bytes following the time will be zeroed */
  var machine3Bytes = BinaryParser.encodeInt(MACHINE_ID, 24, false);
  var pid2Bytes = BinaryParser.fromShort((typeof process === 'undefined' ? Math.floor(Math.random() * 100000) : process.pid) % 0xFFFF);
  var index3Bytes = BinaryParser.encodeInt(this.get_inc(), 24, false, true);

  return time4Bytes + machine3Bytes + pid2Bytes + index3Bytes;
};

/**
* Converts the id into a 24 byte hex string for printing
*
* @return {String} return the 24 byte hex string representation.
* @ignore
*/
ObjectID.prototype.toString = function() {
  return this.toHexString();
};

/**
* Converts to a string representation of this Id.
*
* @return {String} return the 24 byte hex string representation.
* @ignore
*/
ObjectID.prototype.inspect = ObjectID.prototype.toString;

/**
* Converts to its JSON representation.
*
* @return {String} return the 24 byte hex string representation.
* @ignore
*/
ObjectID.prototype.toJSON = function() {
  return this.toHexString();
};

/**
* Compares the equality of this ObjectID with `otherID`.
*
* @method
* @param {object} otherID ObjectID instance to compare against.
* @return {boolean} the result of comparing two ObjectID's
*/
ObjectID.prototype.equals = function equals (otherId) {
  var id;

  if(otherId instanceof ObjectID) {
    return this.toString() == otherId.toString();
  } else if(typeof otherId == 'string' && ObjectID.isValid(otherId) && otherId.length == 12 && this.id instanceof _Buffer) {
    return otherId === this.id.toString('binary');
  } else if(typeof otherId == 'string' && ObjectID.isValid(otherId) && otherId.length == 24) {
    return otherId === this.toHexString();
  } else if(typeof otherId == 'string' && ObjectID.isValid(otherId) && otherId.length == 12) {
    return otherId === this.id;
  } else if(otherId != null && (otherId instanceof ObjectID || otherId.toHexString)) {
    return otherId.toHexString() === this.toHexString();
  } else {
    return false;
  }
}

/**
* Returns the generation date (accurate up to the second) that this ID was generated.
*
* @method
* @return {date} the generation date
*/
ObjectID.prototype.getTimestamp = function() {
  var timestamp = new Date();
  timestamp.setTime(Math.floor(BinaryParser.decodeInt(this.id.substring(0,4), 32, true, true)) * 1000);
  return timestamp;
}

/**
* @ignore
*/
ObjectID.index = ~~(Math.random() * 0xFFFFFF);

/**
* @ignore
*/
ObjectID.createPk = function createPk () {
  return new ObjectID();
};

/**
* Creates an ObjectID from a second based number, with the rest of the ObjectID zeroed out. Used for comparisons or sorting the ObjectID.
*
* @method
* @param {number} time an integer number representing a number of seconds.
* @return {ObjectID} return the created ObjectID
*/
ObjectID.createFromTime = function createFromTime (time) {
  var id = BinaryParser.encodeInt(time, 32, true, true) +
           BinaryParser.encodeInt(0, 64, true, true);
  return new ObjectID(id);
};

// Lookup tables
var encodeLookup = '0123456789abcdef'.split('')
var decodeLookup = []
var i = 0
while (i < 10) decodeLookup[0x30 + i] = i++
while (i < 16) decodeLookup[0x41 - 10 + i] = decodeLookup[0x61 - 10 + i] = i++

var _Buffer = Buffer;
var convertToHex = function(bytes) {
  return bytes.toString('hex');
}

/**
* Creates an ObjectID from a hex string representation of an ObjectID.
*
* @method
* @param {string} hexString create a ObjectID from a passed in 24 byte hexstring.
* @return {ObjectID} return the created ObjectID
*/
ObjectID.createFromHexString = function createFromHexString (string) {
  // Throw an error if it's not a valid setup
  if(typeof string === 'undefined' || string != null && string.length != 24)
    throw new Error("Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");

  var length = string.length;

  if(length > 12*2) {
    throw new Error('Id cannot be longer than 12 bytes');
  }

  // Calculate lengths
  var sizeof = length >> 1;
  var array = new _Buffer(sizeof);
  var n = 0;
  var i = 0;

  while (i < length) {
    array[n++] = decodeLookup[string.charCodeAt(i++)] << 4 | decodeLookup[string.charCodeAt(i++)]
  }

  // var result = array.toString('binary');
  // console.log("!!!!!!!!!!!!!!!!!!!")
  // console.log(array.toString('binary'))


  // var result = ''
  //   , string
  //   , number;
  //
  // for (var index = 0; index < len; index += 2) {
  //   string = hexString.substr(index, 2);
  //   // number = 0 + parseInt(string, 16);
  //   number = 0 + string;
  //   result += BinaryParser.fromByte(number);
  // }ObjectID

  return new ObjectID(array);
};

/**
* Checks if a value is a valid bson ObjectId
*
* @method
* @return {boolean} return true if the value is a valid bson ObjectId, return false otherwise.
*/
ObjectID.isValid = function isValid(id) {
  if(id == null) return false;

  if(typeof id == 'number') {
    return true;
  }

  if(typeof id == 'string') {
    return id.length == 12 || (id.length == 24 && checkForHexRegExp.test(id));
  }

  if(id instanceof ObjectID) {
    return true;
  }

  if(id instanceof _Buffer) {
    return true;
  }

  // Duck-Typing detection of ObjectId like objects
  if(id.toHexString) {
    return id.id.length == 12 || (id.id.length == 24 && checkForHexRegExp.test(id.id));
  }

  return false;
};

/**
* @ignore
*/
Object.defineProperty(ObjectID.prototype, "generationTime", {
   enumerable: true
 , get: function () {
     if(this.id instanceof _Buffer) {
       return this.id[0] | this.id[1] << 8 | this.id[2] << 16 | this.id[3] << 24;
     } else {
       return Math.floor(BinaryParser.decodeInt(this.id.substring(0,4), 32, true, true));
     }
   }
 , set: function (value) {
     var value = BinaryParser.encodeInt(value, 32, true, true);
     this.id = value + this.id.substr(4);
     // delete this.__id;
     this.toHexString();
   }
});

/**
 * Expose.
 */
module.exports = ObjectID;
module.exports.ObjectID = ObjectID;
module.exports.ObjectId = ObjectID;
