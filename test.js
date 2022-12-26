const { PKPWallet } = require('@lit-protocol/pkp-ethers.js-node');

const PKP_PUBKEY =
    '0x040b1f9dba171e2d62cb244082c7fe83917135bd29c3b4dfa10c6ce7b5d7488844e1fefb0af5a4ca15e8aab45be3e63a1b4082bfea443ed3356a664311639eaf2f';
const CONTROLLER_AUTHSIG = { "sig": "0xa527fc31d6330310dac6244218d3e122d07bf93b3f0d5d92b8aa69ec03403c444476d9b625a513683daefe3589cece743348f833a59953374abd39526c8bd5c81b", "derivedVia": "web3.eth.personal.sign", "signedMessage": "localhost:3000 wants you to sign in with your Ethereum account:\n0x019c5821577B1385d6d668d5f3F0DF16A9FA1269\n\n\nURI: http://localhost:3000/\nVersion: 1\nChain ID: 80001\nNonce: V0ho59TkT9p9BpeqC\nIssued At: 2022-12-25T03:27:08.996Z\nExpiration Time: 2027-11-29T03:27:08.988Z", "address": "0x019c5821577B1385d6d668d5f3F0DF16A9FA1269" }

const go = async () => {

    const pkpWallet = new PKPWallet({
        pkpPubKey: PKP_PUBKEY,
        controllerAuthSig: CONTROLLER_AUTHSIG,
        provider: "https://rpc-mumbai.maticvigil.com",
    });

    await pkpWallet.init();

    const tx = {
        to: "0x6d30a9f79a35fe3ede1827f8fd0050ada6fea901",
        value: 0,
    };

    const signedTx = await pkpWallet.signTransaction(tx);
    console.log("signedTx:", signedTx);

    const sentTx = await pkpWallet.sendTransaction(signedTx);
    console.log("sentTx:", sentTx);

}

go();