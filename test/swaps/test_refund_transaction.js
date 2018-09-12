const {test} = require('tap');

const {refundTransaction} = require('./../../swaps');
const {Transaction} = require('./../../tokenslib');

// Test values
const fixtures = {
  bchtestnet_destination: 'mv5tE5PQYTfcvgBE5LujTFyuoZfqWAUfAi',
  bchtestnet_p2sh_refund_transaction: '0100000001156a861dc99d2a12a5ff63f710d132f6eba774648efc006332b674aad5b47b5100000000b44830450221008e0dfc53f88af42b3632d7af905757f22c5c80488d1c90c97e376db59986056e022067a644659f8b4e139a1de9c747bf469fe638c30268257f899aab1c1e8ff069a041004c6876a820035ff161edf1fb1db2c334f3b85e736cfe49d117fcf0d4741146c148941488ee8763752102cab08827d262384d8e1349078c8432d671bb468b9f60c7a298c8a9c0137dd96b67027802b17576a914e7c4f66eabfdbae4861f3de5331ab4f5622ad83f8868ac00000000017c8a052a010000001976a9149fcc17682bbd7da6da493b9d93167c36fb9c32c188acb6010000',
  dust_tokens: 10,
  fee_tokens_per_vbyte: 100,
  p2sh_output_script: 'a91495893fb0b68f0fc575105cbb45fcf76c9324c43287',
  p2sh_p2wsh_output_script: 'a914cb5843af4f313c4bf2c7149c0c3663a2100baf5a87',
  p2wsh_output_script: '0020df5f7d047361e9b70a26b6346dcb01e33480e5304b517ff2599a496dc5ffbd59',
  private_key: 'cSWTkyuuPpVrkrqqr2JuydydUvXzzM9PJgPhTLFFAJmuA4RwLiQj',
  testnet_destination: 'tb1qz5mq03ta0zwrmgs2sy427xdp0wu6hc829f8aar',
  testnet_p2sh_refund_transaction: '0100000001156a861dc99d2a12a5ff63f710d132f6eba774648efc006332b674aad5b47b5100000000b4483045022100ff18b4e6e6721aaa915af336f092709fc02c35fa532e97763f0fdc651ab8a4640220346c5f2a36ce92de651ec970648174310aa94d8be63d9751a005c63189a8e87601004c6876a820035ff161edf1fb1db2c334f3b85e736cfe49d117fcf0d4741146c148941488ee8763752102cab08827d262384d8e1349078c8432d671bb468b9f60c7a298c8a9c0137dd96b67027802b17576a914e7c4f66eabfdbae4861f3de5331ab4f5622ad83f8868ac0000000001a88b052a01000000160014153607c57d789c3da20a812aaf19a17bb9abe0eab6010000',
  testnet_p2sh_p2wsh_refund_transaction: '01000000000101156a861dc99d2a12a5ff63f710d132f6eba774648efc006332b674aad5b47b5100000000232200200715b5f54b7148bc733c90d62c3f0b5d1691804702db8a2b8fe83d1651b7f85d000000000154b2052a01000000160014153607c57d789c3da20a812aaf19a17bb9abe0ea03473044022018791fccfa5a45b037c314c96f06fdb009e03d445c6c88ea0909bef33fb2a88b02203af011e30cfd8cd98fa172ba05ba5b9135f9fc94493ad0273545dc8f4fa4320d01006876a820035ff161edf1fb1db2c334f3b85e736cfe49d117fcf0d4741146c148941488ee8763752102cab08827d262384d8e1349078c8432d671bb468b9f60c7a298c8a9c0137dd96b67027802b17576a914e7c4f66eabfdbae4861f3de5331ab4f5622ad83f8868acb6010000',
  testnet_p2wsh_refund_transaction: '01000000000101156a861dc99d2a12a5ff63f710d132f6eba774648efc006332b674aad5b47b510000000000000000000100c0052a01000000160014153607c57d789c3da20a812aaf19a17bb9abe0ea0347304402204556ba52fa40fa3a8ab641f0bda326da437034521e56fda88ea512de901faa95022023fb6d96bcdc3350a60db5af92518ee1ddcb07968429060eaf0e633b50dbf3d501006876a820035ff161edf1fb1db2c334f3b85e736cfe49d117fcf0d4741146c148941488ee8763752102cab08827d262384d8e1349078c8432d671bb468b9f60c7a298c8a9c0137dd96b67027802b17576a914e7c4f66eabfdbae4861f3de5331ab4f5622ad83f8868acb6010000',
  timelock_block_height: 438,
  utxo: {
    redeem: '76a820035ff161edf1fb1db2c334f3b85e736cfe49d117fcf0d4741146c148941488ee8763752102cab08827d262384d8e1349078c8432d671bb468b9f60c7a298c8a9c0137dd96b67027802b17576a914e7c4f66eabfdbae4861f3de5331ab4f5622ad83f8868ac',
    tokens: 5000000000,
    transaction_id: '517bb4d5aa74b6326300fc8e6474a7ebf632d110f763ffa5122a9dc91d866a15',
    vout: 0,
  },
};

// Test scenarios
const tests = {
  // Successful bcashregtest p2sh pk refund transaction
  bcashregtest_p2sh_pk_refund_transaction: {
    args: {
      destination: 'RMnERAKEbMcqq415Af7bmxdrUXuUe1NgZK',
      fee_tokens_per_vbyte: 100,
      is_public_key_hash_refund: false,
      network: 'bcashregtest',
      private_key: 'ETJpAow9WVyNQ3AFhDmor4NREMga7nn3fG3gyZEyHp8hWUi4BtPH',
      timelock_block_height: 457,
      utxos: [{
        redeem: 'a914351dbe9435e66e9ad4efda2ad14e0ff75dcf5a418763210328e7a5e1c9e0b4c742cdc57f0902a6e734fe9fcffe84ec9d92de38c34f47f9076702c901b17521020907a39f10a4588a976361bfd1a8efbfde6843d5ead9a2944697d808f742731d68ac',
        script: 'a91493622c006aa6c22988e819fd39263c34963d508287',
        tokens: 5000000000,
        transaction_id: '41d2db939285eb7046d1c5805042c4d056ee9ae1d47a0ce1188044d49336585c',
        vout: 0,
      }],
    },
    msg: 'Bcashregtest p2sh pk refund transaction is formed correctly',
    refund: '01000000015c583693d4448018e10c7ad4e19aee56d0c4425080c5d14670eb859293dbd24100000000b0483045022100dc7ea173edce7918dc1a7f1aaccb2759e8846661daa993b0aa7362134dfe39ea022063b2f09ebb48dd8364342f44d61e6dac432969acb60860178be05edd0b376a7441004c64a914351dbe9435e66e9ad4efda2ad14e0ff75dcf5a418763210328e7a5e1c9e0b4c742cdc57f0902a6e734fe9fcffe84ec9d92de38c34f47f9076702c901b17521020907a39f10a4588a976361bfd1a8efbfde6843d5ead9a2944697d808f742731d68ac00000000010c8c052a010000001976a914891f8649545e4b59b66fd9881a8e30bcfe03d2e088acc9010000',
  },

  // Successful bcashregtest p2sh pkhash refund transaction
  bcashregtest_p2sh_pkhash_refund_transaction: {
    args: {
      destination: 'RPaFuhRcqXMaTEqerrLzUwH5hPcc19eP2j',
      fee_tokens_per_vbyte: 100,
      is_public_key_hash_refund: true,
      network: 'bcashregtest',
      private_key: 'EP4cKaQry9zn7i6sQwxNxLZ25w72LAvjqF6ATWopUCfj2Adn8uKv',
      timelock_block_height: 457,
      utxos: [{
        vout: 0,
        redeem: '76a914e5a040cebcd355c0d50ba4db23ac01589d146aa68763752102781624b5e9fbc63a5f058905cc79c7c9e1d39925a5f23f167934a6c0bbf592c46702c901b17576a9149ccc07b1269f4c1e4deb681965924f6ca8ea35de8868ac',
        script: 'a9146c96ba094050bbdfb00d5a2e28895fb13651205f87',
        tokens: 5000000000,
        transaction_id: 'c3528a2ce6316de104adcd14ee460dbdb9088baf2d29335d10ff44eee6f192ce',
      }],
    },
    msg: 'Bcashregtest p2sh pkhash refund transaction is formed correctly',
    refund: '0100000001ce92f1e6ee44ff105d33292daf8b08b9bd0d46ee14cdad04e16d31e62c8a52c300000000c847304402207801a98189288994cc5a66c93b8c07fe7fdc387fd0ba261b56b5a90a01c958d802207dff89e70d7b24a377d6bfbcfb9e2a195a394367aaa5a4c816797765c0d572eb412102a8dbcc06d99c957257d3d84503214f91a88b8c76a0ef023cfbfd2a729c17ae144c5c76a914e5a040cebcd355c0d50ba4db23ac01589d146aa68763752102781624b5e9fbc63a5f058905cc79c7c9e1d39925a5f23f167934a6c0bbf592c46702c901b17576a9149ccc07b1269f4c1e4deb681965924f6ca8ea35de8868ac00000000014882052a010000001976a9149ccc07b1269f4c1e4deb681965924f6ca8ea35de88acc9010000',
  },

  // Failure of refund transaction due to dust output
  dust_output_fails_refund_transaction: {
    args: {
      destination: 'mkaRv1vEoTR2cCBDqeerPC9dT8UZEYKnf3',
      fee_tokens_per_vbyte: 9500000,
      is_public_key_hash_refund: true,
      network: 'regtest',
      private_key: 'cQpxVDyFPzHvKriEaJXNZWvs1oByP1RRQRgoEPSpr4c71GYDfddd',
      timelock_block_height: 457,
      utxos: [{
        redeem: '76a914a3ef07f655db4b8c7ed7cf50b58e9853009871768763752102b663662fb8b47ef81d40a8e7f27c1e7a0c86793456b4a124473c33807c0be8576702c901b17576a9143780eecfb59132e28a830eea01529108384a790d8868ac',
        script: '00200887d6d29641c538e3e3cfadc5409617fd22e8cb89e003c93b7e6992ccb12cef',
        tokens: 5000000000,
        transaction_id: '954045e13f0f12cde9a005fac248c2a12d9b3a65481f01fb24a26e4575f97e5e',
        vout: 0,
      }],
    },
    err: 'RefundOutputTooSmall',
    msg: 'Refund transaction does not allow a dust output',
  },

  // Successful regtest p2sh pk refund transaction
  regtest_p2sh_pk_refund_transaction: {
    args: {
      destination: 'n2zcdtAuaUSRcEAWzgJU7gHwBjVPNYfbyf',
      fee_tokens_per_vbyte: 100,
      is_public_key_hash_refund: false,
      network: 'regtest',
      private_key: 'cN6WbzW9JB2xUNSmVjUZuX9aEUZsoXkKhaPn4pogrqd36CdM617A',
      timelock_block_height: 457,
      utxos: [{
        redeem: 'a9143d37a9d8549e6aa53a196f326e9cb78acc97f0d987632102fc7b43cfe0d2c3aa2536a4159f6abc7b05a03cbf004961aa93fbd7d2a2128a296702c901b17521037c48181e6350df03eba639942de35fdbf1b5547db5ac31ea97ace48aca4a464068ac',
        script: 'a9149039c0c03037dd0908e05a71656252d155f13db187',
        tokens: 5000000000,
        transaction_id: 'f08f65d912cedbae1051dbee40cbb2e9f12dda4909b8fdf6cd473367e52b8b2b',
        vout: 0,
      }],
    },
    msg: 'Regtest p2sh pk refund transaction is formed correctly',
    refund: '01000000012b8b2be5673347cdf6fdb80949da2df1e9b2cb40eedb5110aedbce12d9658ff000000000af473044022051267f846022012d4fc528438a420c6e7ee113582b9e08d805ace4abbc24d03302207b84bebd406fb1a2fe1494a64a2041e0786ea69f56068b29ff374091d17a1fab01004c64a9143d37a9d8549e6aa53a196f326e9cb78acc97f0d987632102fc7b43cfe0d2c3aa2536a4159f6abc7b05a03cbf004961aa93fbd7d2a2128a296702c901b17521037c48181e6350df03eba639942de35fdbf1b5547db5ac31ea97ace48aca4a464068ac0000000001a88b052a010000001976a914eb95e0ed11e5d2d000bf74f921422d37d9ade39c88acc9010000',
  },

  // Successful regtest p2sh pkhash refund transaction
  regtest_p2sh_pkhash_refund_transaction: {
    args: {
      destination: 'mgiaSy97gZvYzUixyRFPsrefwdvZEgxWa3',
      fee_tokens_per_vbyte: 100,
      is_public_key_hash_refund: true,
      network: 'regtest',
      private_key: 'cPJ2o1SRJxtzqvVb4Ru5Q5QXwgJr153hdNUz1Eu4SegG9yB4rzbS',
      timelock_block_height: 457,
      utxos: [{
        vout: 0,
        redeem: '76a914557ddc10e60519af965adaaec291ad6a413500dc876375210268c552776a406690b8f2b1427a9de09156970431e081502ae66f9d3a1f8c28b26702c901b17576a9140d2ae18636b5a3782eac99b363557ae5c668a5e48868ac',
        script: 'a9145e0a5c67e55d1196dca76f4e11796ae2a1c040a087',
        tokens: 5000000000,
        transaction_id: '6e8139eb7b16907442dea43b82be2932de4dd6f7a513453b2269b10acf2e6b12',
      }],
    },
    msg: 'Regtest p2sh pkhash refund transaction is formed correctly',
    refund: '0100000001126b2ecf0ab169223b4513a5f7d64dde3229be823ba4de427490167beb39816e00000000c9483045022100daf173542cd296ebc8537f640abca58b2be4a768b945b68fb426eacce6be423e0220075d356c079384e7e00152d167987396ce9a873dc8a4d60d3c986adfab3b983e012103e79218022baea5f44a70c624762c04c2f620e6719239023ee1d0c12f84ca33dc4c5c76a914557ddc10e60519af965adaaec291ad6a413500dc876375210268c552776a406690b8f2b1427a9de09156970431e081502ae66f9d3a1f8c28b26702c901b17576a9140d2ae18636b5a3782eac99b363557ae5c668a5e48868ac00000000014882052a010000001976a9140d2ae18636b5a3782eac99b363557ae5c668a5e488acc9010000',
  },

  // Successful regtest p2sh p2wsh pk refund transaction
  regtest_p2sh_p2wsh_pk_refund_transaction: {
    args: {
      destination: 'mkUahiihhNS1UomyuXz64CuDHouryERoYS',
      fee_tokens_per_vbyte: 100,
      is_public_key_hash_refund: false,
      network: 'regtest',
      private_key: 'cRNEVSANnuud4dUpBsFr9VTuL9c13azjsBJTTjcWK7cQANxB7TZD',
      timelock_block_height: 457,
      utxos: [{
        redeem: 'a9144fffb61b948a0c36e566d4e06807b4ef2a5b586f87632103adc19703bba0735fd34aa49f72ed452c8b3701a08d0a9a6f72c1363cbc17e0656702c901b17521021b3551331f36799dd5147985a7674c895eea412fabeedc646b022d6502fc996d68ac',
        script: 'a914d9664c9b9363d7f3b04310f954a32174c4bb139c87',
        tokens: 5000000000,
        transaction_id: 'e0c112d5cb1c8981e1f5cc881b5f7808f0f288354fbb95a549a9006e644159d0',
        vout: 0,
      }],
    },
    msg: 'Regtest p2sh p2wsh pk refund transaction is formed correctly',
    refund: '01000000000101d05941646e00a949a595bb4f3588f2f008785f1b88ccf5e181891ccbd512c1e000000000232200201a4a8012bece820aa741a33b3a1a7073cc66c380dbd5004fc79b7d983af29c3900000000018cb1052a010000001976a9143665c5ded601a2eace81f963442fb8c3f81c1d9b88ac03483045022100902491bbf034ebd2a6e08793d10263f4265352548bfccb4c362f30481d5e1be502206098ab73479c43153ea64c389e4364d11cf7afd979e3065e6c8621d81b4426f8010064a9144fffb61b948a0c36e566d4e06807b4ef2a5b586f87632103adc19703bba0735fd34aa49f72ed452c8b3701a08d0a9a6f72c1363cbc17e0656702c901b17521021b3551331f36799dd5147985a7674c895eea412fabeedc646b022d6502fc996d68acc9010000',
  },

  // Successful regtest p2sh p2wsh pkhash refund transaction
  regtest_p2sh_p2wsh_pkhash_refund_transaction: {
    args: {
      destination: 'n4VBca3XWgEwKZWXBcCwxB4BgrXDPPfWMh',
      fee_tokens_per_vbyte: 100,
      is_public_key_hash_refund: true,
      network: 'regtest',
      private_key: 'cSGK2UNxr6fq2ofwwgvCV3rbg6ELaAYCs4coseXCEi9A3KcDGiRj',
      timelock_block_height: 457,
      utxos: [{
        redeem: '76a914474bae727550db7fe9e8b3401f9212f6f66a8ef48763752102957f7bda09b441b4df84195b0b2e7204a8aebe42384fd058f1c7ae30ac6ec94b6702c901b17576a914fbf52df0a98760fba0d504f607fc9459676488688868ac',
        script: 'a9141ecd717b37a4baaeb8385a4336a7ff0fd78a5a2987',
        tokens: 5000000000,
        transaction_id: 'cf663e0aabb401e0362948932828908c2c09202eee6c7c36f526922f4996cfea',
        vout: 0,
      }],
    },
    msg: 'Regtest p2sh p2wsh pkhash refund transaction is formed correctly',
    refund: '01000000000101eacf96492f9226f5367c6cee2e20092c8c90282893482936e001b4ab0a3e66cf0000000023220020297df18ce6a24161125693d3f4ed4017c8b5b8e3dc0322aa67b836d42778467e000000000134af052a010000001976a914fbf52df0a98760fba0d504f607fc94596764886888ac034730440220160f856010e72dd0cfba067b902382bbbc6031717c00fd3013a8b967c55a303902207f02e0afd3246151dbd2ebcf649a68e0d15bdf8bb2f217f868919fbd5c1099760121029476dfdc86519011a460a3ea397f4a0d1d459cb5947ef53278688c9c0a69dd695c76a914474bae727550db7fe9e8b3401f9212f6f66a8ef48763752102957f7bda09b441b4df84195b0b2e7204a8aebe42384fd058f1c7ae30ac6ec94b6702c901b17576a914fbf52df0a98760fba0d504f607fc9459676488688868acc9010000',
  },

  // Successful regtest p2wsh pk refund transaction
  regtest_p2wsh_pk_refund_transaction: {
    args: {
      destination: 'n1wYgrNPDAzJJCmKjNoA1NWJQ8HXApVrRt',
      fee_tokens_per_vbyte: 100,
      is_public_key_hash_refund: false,
      network: 'regtest',
      private_key: 'cR3q9YiXhSeo7GLH7P7hNzefTutHorzwQ62iMRLet1jDPMRcUoVo',
      timelock_block_height: 457,
      utxos: [{
        vout: 0,
        redeem: 'a9142548f241dfcac02162003df2be8cbe2d96466d068763210201f8f730d2cd704dce5d4740fa8363834ddcca3477aaced70b82dde82afb636b6702c901b1752102cd1cbd99950d32093688890c77452b236f54b4aa7387bf2108778969062e8a7f68ac',
        script: '0020beab4de4dad346337978192e8992351c834ee77d60ccc6bc9cdd58ee51eede73',
        tokens: 5000000000,
        transaction_id: '00b3c3c413ab282e6138aca84cd0fa346b4728cafb508e06d1ab3d7439164ae2',
      }],
    },
    msg: 'Regtest p2wsh pk refund transaction is formed correctly',
    refund: '01000000000101e24a1639743dabd1068e50fbca28476b34fad04ca8ac38612e28ab13c4c3b3000000000000000000000138bf052a010000001976a914e0093569d8f32f87b7c9f34166f21f759031a50688ac0347304402200e918bde4a401e8d6487e9c3662275f8bc58e4520edafd8d004a1171361e1d4302200f9f3937f1b2f7fa8cfd3f86360b4f3ca2c4e628b68fb4c3760c5ea426bab825010064a9142548f241dfcac02162003df2be8cbe2d96466d068763210201f8f730d2cd704dce5d4740fa8363834ddcca3477aaced70b82dde82afb636b6702c901b1752102cd1cbd99950d32093688890c77452b236f54b4aa7387bf2108778969062e8a7f68acc9010000',
  },

  // Successful regtest p2wsh pkhash refund transaction
  regtest_p2wsh_pkhash_refund_transaction: {
    args: {
      destination: 'mkaRv1vEoTR2cCBDqeerPC9dT8UZEYKnf3',
      fee_tokens_per_vbyte: 100,
      is_public_key_hash_refund: true,
      network: 'regtest',
      private_key: 'cQpxVDyFPzHvKriEaJXNZWvs1oByP1RRQRgoEPSpr4c71GYDfddd',
      timelock_block_height: 457,
      utxos: [{
        redeem: '76a914a3ef07f655db4b8c7ed7cf50b58e9853009871768763752102b663662fb8b47ef81d40a8e7f27c1e7a0c86793456b4a124473c33807c0be8576702c901b17576a9143780eecfb59132e28a830eea01529108384a790d8868ac',
        script: '00200887d6d29641c538e3e3cfadc5409617fd22e8cb89e003c93b7e6992ccb12cef',
        tokens: 5000000000,
        transaction_id: '954045e13f0f12cde9a005fac248c2a12d9b3a65481f01fb24a26e4575f97e5e',
        vout: 0,
      }],
    },
    msg: 'Regtest p2wsh pkhash refund transaction is formed correctly',
    refund: '010000000001015e7ef975456ea224fb011f48653a9b2da1c248c2fa05a0e9cd120f3fe145409500000000000000000001e0bc052a010000001976a9143780eecfb59132e28a830eea01529108384a790d88ac034730440220447226881d0a031761b63edf4ccbc1bd1ad35cb184e8b654f0fc5ea347d817a10220760af5ca7e51b96252bb1ab68377c19346b70e5d116d47bb80f0415cd1eb6e7501210249b3208a9ddc1a23924588764f4e755917423c1bcddc040f1c9532e14841e92a5c76a914a3ef07f655db4b8c7ed7cf50b58e9853009871768763752102b663662fb8b47ef81d40a8e7f27c1e7a0c86793456b4a124473c33807c0be8576702c901b17576a9143780eecfb59132e28a830eea01529108384a790d8868acc9010000',
  },
};

// Run the tests
Object.keys(tests).map(t => tests[t]).forEach(({args, err, msg, refund}) => {
  return test(msg, t => {
    if (!!err) {
      t.throws(() => refundTransaction(args), new Error(err));
    } else {
      t.equal(refundTransaction(args).transaction, refund);
    };

    return t.end()
  });
});

