/**
 * Author: Maor Magori
 * Heavily inspired by @magicdawn superagent-charset package: https://github.com/magicdawn/superagent-charset
 */

const chardet = require("chardet");
const iconv = require("iconv-lite");

module.exports = function install(superagent) {
  const Request = superagent.Request;

  /**
   * add `charset` to request
   *
   * @param {String} enc : the encoding
   */

  Request.prototype.charset = function (enc) {
    if (!enc) enc = "UTF-8";
    this._parser = function (res, cb) {
      const chunks = [];

      res.on("data", function (chunk) {
        chunks.push(chunk);
      });

      res.on("end", function () {
        let text, err;
        const responseBuffer = Buffer.concat(chunks);

        try {
          detectedEncoding = chardet.detect(responseBuffer);
          if (!detectedEncoding) {
            detectedEncoding = enc;
          }
          text = iconv.decode(responseBuffer, detectedEncoding);
        } catch (e) {
          err = e;
        } finally {
          res.text = text;
          cb(err);
        }
      });
    };

    return this;
  };

  return superagent;
};
