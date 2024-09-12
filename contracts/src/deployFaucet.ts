/**
 * This script can be used to interact with the Add contract, after deploying it.
 *
 * We call the update() method on the contract, create a proof and send it to the chain.
 * The endpoint that we interact with is read from your config.json.
 *
 * This simulates a user interacting with the zkApp from a browser, except that here, sending the transaction happens
 * from the script and we're using your pre-funded zkApp account to pay the transaction fee. In a real web app, the user's wallet
 * would send the transaction and pay the fee.
 *
 * To run locally:
 * Build the project: `$ npm run build`
 * Run with node:     `$ node build/src/deploy.js`.
 */
import fs from 'fs/promises';
import { FungibleToken, FungibleTokenAdmin } from 'mina-fungible-token';
import { AccountUpdate, Bool, Cache, fetchAccount, Field, Mina, NetworkId, PrivateKey, PublicKey, SmartContract, UInt64, UInt8 } from 'o1js';
import readline from "readline/promises";
import { Faucet } from './Faucet.js';

const prompt = async (message: string) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const answer = await rl.question(message);

    rl.close(); // stop listening
    return answer;
};

// check command line arg
let deployAlias = "faucet";
if (!deployAlias)
    throw Error(`Missing <deployAlias> argument.

Usage:
node build/src/deployFaucet.js
`);
Error.stackTraceLimit = 1000;
const DEFAULT_NETWORK_ID = 'zeko';

// parse config and private key from file
type Config = {
    deployAliases: Record<
        string,
        {
            networkId?: string;
            url: string;
            keyPath: string;
            fee: string;
            feepayerKeyPath: string;
            feepayerAlias: string;
        }
    >;
};
let configJson: Config = JSON.parse(await fs.readFile('config.json', 'utf8'));
let config = configJson.deployAliases[deployAlias];
let feepayerKeysBase58: { privateKey: string; publicKey: string } = JSON.parse(
    await fs.readFile(config.feepayerKeyPath, 'utf8'));

let feepayerKey = PrivateKey.fromBase58(feepayerKeysBase58.privateKey);
// B62qnPKGpfthW2gbKf8Z2QxRokF8w354ui1oPWBWePHoHk5opPuEM6V
let zkTokenPrivateKey = PrivateKey.fromBase58("EKESjqtbt5HFwkYCQfebMLbdTrMXXdqcQMYqjN3sJua9UUxLq9WC");
// B62qoD1abb237yRZ5c9jqeW4nLWs1wPE2eiVwPdHJa1rKSTxZC66rts
let zkTokenAdminPrivateKey = PrivateKey.fromBase58("EKEJNKbSmmWGFA2YAekBf834pkhY7xYe8vC1NQq2dXUP4463WM6W");
// B62qrcjVWC5H4mkhJjLhBfWXx1hRP7F2dUt57QouaZ6ABZh48DD6wgP
let zkFaucetKey = PrivateKey.fromBase58("EKEbV8YQWmPrFav5YWbF8ugMtos3CpL6iQfaRGB2UNCct83ar7sk");

// set up Mina instance and contract we interact with
const Network = Mina.Network({
    // We need to default to the testnet networkId if none is specified for this deploy alias in config.json
    // This is to ensure the backward compatibility.
    networkId: (config.networkId ?? DEFAULT_NETWORK_ID) as NetworkId,
    //mina: "https://devnet.zeko.io/graphql",
    mina: "https://api.minascan.io/node/devnet/v1/graphql",
    archive: 'https://api.minascan.io/archive/devnet/v1/graphql',
});
console.log("network", config.url);
// const Network = Mina.Network(config.url);
const fee = Number(config.fee) * 1e9; // in nanomina (1 billion = 1.0 mina)
Mina.setActiveInstance(Network);
let feepayerAddress = feepayerKey.toPublicKey();
let zkTokenAddress = zkTokenPrivateKey.toPublicKey();
let zkToken = new FungibleToken(zkTokenAddress);
let zkTokenAdminAddress = zkTokenAdminPrivateKey.toPublicKey();
let zkTokenAdmin = new FungibleTokenAdmin(zkTokenAdminAddress);
let zkFaucetAddress = zkFaucetKey.toPublicKey();
let zkFaucet = new Faucet(zkFaucetAddress, zkToken.deriveTokenId());

console.log("tokenStandard", zkTokenAddress.toBase58());
console.log("zkTokenAdmin", zkTokenAdminAddress.toBase58());
console.log("zkFaucet", zkFaucetAddress.toBase58());

// compile the contract to create prover keys
console.log('compile the contract...');

const cache: Cache = Cache.FileSystem('./cache');
await FungibleToken.compile({ cache });
await FungibleTokenAdmin.compile({ cache });
await Faucet.compile({ cache });
//const keyV2 = await PoolMinaV2.compile({ cache });

async function ask() {
    try {
        const result = await
            prompt(`Why do you want to do ?
            1 deploy token
            2 deploy faucet   
            3 claim
            `);
        switch (result) {
            case "1":
                await deployToken();
                break;
            case "2":
                await deployFaucet();
                break;
            case "3":
                await claim();
                break;

            default:
                await ask();
                break;
        }
    } catch (error) {
        await ask();
    }
    finally {
        await ask();
    }
}

await ask();

async function deployToken() {
    try {
        console.log("deploy token standard");

        let tx = await Mina.transaction(
            { sender: feepayerAddress, fee },
            async () => {
                AccountUpdate.fundNewAccount(feepayerAddress, 3);
                await zkTokenAdmin.deploy({
                    adminPublicKey: feepayerAddress,
                });
                await zkToken.deploy({
                    symbol: "FAU",
                    src: "https://github.com/MinaFoundation/mina-fungible-token/blob/main/FungibleToken.ts",
                });
                await zkToken.initialize(
                    zkTokenAdminAddress,
                    UInt8.from(9),
                    Bool(false),
                );
            }
        );
        await tx.prove();
        let sentTx = await tx.sign([feepayerKey, zkTokenPrivateKey, zkTokenAdminPrivateKey]).send();
        if (sentTx.status === 'pending') {
            console.log("hash", sentTx.hash);
        }


    } catch (err) {
        console.log(err);
    }
}


async function deployFaucet() {
    try {
        console.log("deploy faucet");

        let tx = await Mina.transaction(
            { sender: feepayerAddress, fee },
            async () => {
                AccountUpdate.fundNewAccount(feepayerAddress, 1);
                // 100 token by claim
                await zkFaucet.deploy({
                    token: zkTokenAddress,
                    amount: UInt64.from(100 * 10 ** 9)
                });
                await zkToken.approveAccountUpdate(zkFaucet.self);

                // 1'000'000 tokens in the faucet
                await zkToken.mint(
                    zkFaucetAddress,
                    UInt64.from(1000000 * 10 ** 9)
                );
            }
        );
        await tx.prove();
        let sentTx = await tx.sign([feepayerKey, zkTokenPrivateKey, zkFaucetKey]).send();
        if (sentTx.status === 'pending') {
            console.log("hash", sentTx.hash);
        }


    } catch (err) {
        console.log(err);
    }
}


async function claim() {
    try {
        console.log("claim");
        let tx = await Mina.transaction({ sender: feepayerAddress, fee }, async () => {
            AccountUpdate.fundNewAccount(feepayerAddress, 1);
            await zkFaucet.claim();
            await zkToken.approveAccountUpdate(zkFaucet.self);
        });
        await tx.prove();
        let sentTx = await tx.sign([feepayerKey, zkTokenPrivateKey]).send();
        if (sentTx.status === 'pending') {
            console.log("hash", sentTx.hash);
        }


    } catch (err) {
        console.log(err);
    }
}

