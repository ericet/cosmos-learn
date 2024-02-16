
import { validateMnemonic } from 'bip39';
import { DirectSecp256k1HdWallet,DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import { Slip10RawIndex } from "@cosmjs/crypto";
import {
    PrivateKey,
    InjectiveDirectEthSecp256k1Wallet
} from "@injectivelabs/sdk-ts"

export async function getSigner(chain, mnemonicOrKey) {
    let isMnemonic = validateMnemonic(mnemonicOrKey);
    let signer;
    if (chain.slip44 && chain.slip44 === 60) {
        if (isMnemonic) {
            const privateKeyFromMnemonic = PrivateKey.fromMnemonic(mnemonicOrKey)
            signer = (await InjectiveDirectEthSecp256k1Wallet.fromKey(
                Buffer.from(privateKeyFromMnemonic.toPrivateKeyHex().replace("0x", ""), "hex"), chain.prefix))
        } else {
            signer = (await InjectiveDirectEthSecp256k1Wallet.fromKey(
                Buffer.from(mnemonicOrKey, "hex"), chain.prefix));

        }
    } else {
        let hdPath = [
            Slip10RawIndex.hardened(44),
            Slip10RawIndex.hardened(chain.slip44 || 118),
            Slip10RawIndex.hardened(0),
            Slip10RawIndex.normal(0),
            Slip10RawIndex.normal(0),
        ];
        if (isMnemonic) {
            signer = await DirectSecp256k1HdWallet.fromMnemonic(
                mnemonicOrKey,
                { prefix: chain.prefix, hdPaths: [hdPath] }
            );
        } else {
            //TODO: doesn't seem to generate correct cosmos address
            const privateKey = Buffer.from(mnemonicOrKey.replace("0x", ""), "hex");
            signer = await DirectSecp256k1Wallet.fromKey(privateKey, chain.prefix)
        }

    }
    return signer;
}
