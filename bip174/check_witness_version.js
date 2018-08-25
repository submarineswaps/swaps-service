const maxWitnessVersion = 16;
const minWitnessVersion = 0;

/** Check that a witness version is correct

  {
    version: <Version Number>
  }

  @throws
  <UnexpectedWitnessVersion Error>
*/
module.exports = ({version}) => {
  if (version === null || version === undefined) {
    throw new Error('ExpectedWitnessVersion');
  }

  if (version < minWitnessVersion || version > maxWitnessVersion) {
    throw new Error('InvalidVersionNumberForWitnessScriptPub');
  }

  return;
};

