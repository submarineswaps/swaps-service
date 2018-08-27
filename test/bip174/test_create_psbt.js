const {test} = require('tap');

const {createPsbt} = require('./../../bip174');

// Test scenarios
const tests = {
  a_creator_creating_a_psbt_for_a_transaction: {
    args: {
      outputs: [
        {
          script: '0014d85c2b71d0060b09c9886aeb815e50991dda124d',
          tokens: 149990000,
        },
        {
          script: '001400aea9a2e5f0f876a588df5546e8742d1d87008f',
          tokens: 100000000,
        },
      ],
      utxos: [
        {
          id: '75ddabb27b8845f5247975c8a5ba7c6f336c4570708ebe230caf6db5217ae858',
          vout: 0,
        },
        {
          id: '1dea7cd05979072a3578cab271c02244ea8a090bbb46aa680a65ecd027048d83',
          vout: 1,
        },
      ],
    },
    msg: 'A creator creating a PSBT for a transaction',
    result: {
      psbt: '70736274ff01009a020000000258e87a21b56daf0c23be8e7070456c336f7cbaa5c8757924f545887bb2abdd750000000000ffffffff838d0427d0ec650a68aa46bb0b098aea4422c071b2ca78352a077959d07cea1d0100000000ffffffff0270aaf00800000000160014d85c2b71d0060b09c9886aeb815e50991dda124d00e1f5050000000016001400aea9a2e5f0f876a588df5546e8742d1d87008f000000000000000000',
    },
  },
};

// Run the tests
Object.keys(tests).map(t => tests[t]).forEach(({args, err, msg, result}) => {
  return test(msg, ({end, equal, throws}) => {
    if (!!err) {
      throws(() => encodePsbt(args), new Error(err));

      return end();
    }

    const {psbt} = createPsbt(args);

    equal(psbt, result.psbt);

    return end();
  });
});

