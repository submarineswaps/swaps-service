const requiredConfirmations = 2;

const msPerConfirmation = 1000 * 60 * 20;

/** Determine how long a transaction needs to wait to be confirmed

  {
    current_confirmations: <Current Confirmation Count Number>
  }

  @returns
  {
    wait_confirmations: <Remaining Confirmations Number>
    wait_time_ms: <Wait Time Necessary Ms Number>
  }
*/
module.exports = args => {
  const remaining = requiredConfirmations - args.current_confirmations;

  const isConfirming = remaining > 0;

  if (!isConfirming) {
    return {remaining_confirmations: 0, wait_time_ms: 0};
  }

  return {
    remaining_confirmations: remaining,
    wait_time_ms: remaining * msPerConfirmation,
  };
};

