import { Secp256k1HdWallet, makeCosmoshubPath } from "@cosmjs/amino";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { createInterface } from "readline";
import { stringToPath } from "@cosmjs/crypto";

async function walletGenerate() {
    let wallet = await Secp256k1HdWallet.generate(24);
    return wallet.secret.data;
}

function getWalletWithAccountSize(mnemonic, accountSize, prefix) {
    return new Promise(async (resolve) => {
        let ops = {
            bip39Password: "",
            hdPaths: [],
            prefix: prefix,
        }

        for (let i = 0; i < accountSize; i++) {
            ops.hdPaths.push(stringToPath(`m/44'/529'/0'/0/${i}`));
        }
        let wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, ops);
        resolve(wallet);
    })

}




const readline = createInterface({
    input: process.stdin,
    output: process.stdout
});
readline.question("How many Secret Network accounts do you want to create:\n", async (input) => {
    let numOfAccounts = Number(input);
    let mnemonic = await walletGenerate();
    console.log(`MNEMONIC: ` + mnemonic);
    let wallet = await getWalletWithAccountSize(mnemonic, numOfAccounts, 'secret');
    let accounts = await wallet.getAccounts();
    for (let i=0;i<accounts.length;i++) {
        console.log(`ADDRESS${i}: ${accounts[i].address}`);
    }

    process.exit()

});