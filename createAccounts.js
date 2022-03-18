import { Secp256k1HdWallet,makeCosmoshubPath } from "@cosmjs/amino";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import {createInterface} from "readline";
async function walletGenerate() {
    let wallet = await Secp256k1HdWallet.generate(24);
    return wallet.secret.data;
}

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




const readline = createInterface({
    input: process.stdin,
    output: process.stdout
});
readline.question("How many wallets do you want to create:\n", async(input) => {
    let numOfWallets = Number(input);
    for (let i = 0; i < numOfWallets; i++) {
        let mnemonic = await walletGenerate();
        console.log(`MNEMONIC${i}: `+mnemonic);
        let wallet = await getWalletWithAccountSize(mnemonic,1,'cosmos');
        let accounts = await wallet.getAccounts();
        for(let account of accounts){
            console.log(`ADDRESS${i}: ${account.address}`);
        }
        console.log("====================================")
    }
    process.exit()
      
  });