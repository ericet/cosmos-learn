import { Secp256k1HdWallet,makeCosmoshubPath } from "@cosmjs/amino";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

async function walletGenerate() {
    let wallet = await Secp256k1HdWallet.generate(24);
    return wallet.secret.data;
}

// Genearte encrypted json
async function walletToJson(wallet) {
    let walletStr = await wallet.serialize("123456");
    console.log("wallet string: ", walletStr);
}

// Populate addresses from mnemonic
function getWalletWithAccountSize(mnemonic, accountSize, prefix) {
    return new Promise(async(resolve)=>{
        let ops = {
            bip39Password: "",
            hdPaths: [],
            prefix: prefix,
        }
    
        for (let i = 0; i < accountSize; i++) {
            ops.hdPaths.push(makeCosmoshubPath(i));
        }
        let wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, ops);
        resolve(wallet);
    })
   
}

// Populate addresses from mnemonic
async function getAccounts(mnemonic, accountSize,prefix){
    let wallet = await getWalletWithAccountSize(mnemonic, accountSize,prefix);
    let accounts = await wallet.getAccounts();
    return accounts;
}



(async () => {
    for (let i = 0; i < 1; i++) {
        let mnemonic = await walletGenerate();
        console.log(`MNEMONIC: `+mnemonic);
        let accounts = await getAccounts(mnemonic,10,'cosmos');
        for(let account of accounts){
            console.log("ADDRESS: "+account.address);
        }
    }
})();