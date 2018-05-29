const {decompile} = require('bitcoinjs-lib').script;

/** Relevant script elements from script signature and witness to normalize the
  scriptsig against a witness model.

  {
    script: <Script Signature Buffer>
    witness: [<Witness Script Buffer>]
  }

  @returns
  {
    [<Script Buffer>]
  }
*/
module.exports = ({script, witness}) => {
  return !!witness && !!witness.length ? witness : decompile(script);
};

