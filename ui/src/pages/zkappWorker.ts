import { Account, AccountUpdate, Bool, Mina, PrivateKey, PublicKey, UInt32, UInt64, fetchAccount } from "o1js";

console.log('Load Web Worker.');

import type { FungibleToken, FungibleTokenAdmin, Faucet } from "../../../contracts/src/index";

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

const state = {
  TokenAdmin: null as null | typeof FungibleTokenAdmin,
  TokenStandard: null as null | typeof FungibleToken,
  Faucet: null as null | typeof Faucet,
  zkToken: null as null | FungibleToken,
  zkFaucet: null as null | Faucet,
  transaction: null as null | Transaction,
  key: null as null | string,
  isZeko: false,
};

// ---------------------------------------------------------------------------------------

const functions = {
  setActiveInstanceToDevnet: async (args: {}) => {
    let currentLocation = self.location.origin;
    const devnet = Mina.Network(
      {
        networkId: "testnet",
        mina: "https://api.minascan.io/node/devnet/v1/graphql",
        archive: 'https://api.minascan.io/archive/devnet/v1/graphql'
      }
    );
    state.isZeko = false;
    Mina.setActiveInstance(devnet);
  },
  setActiveInstanceToZeko: async (args: {}) => {
    const zeko = Mina.Network(
      {
        networkId: "testnet",
        mina: "https://devnet.zeko.io/graphql",
        //archive: 'https://api.minascan.io/archive/devnet/v1/graphql'
      }
    );
    state.isZeko = true;
    Mina.setActiveInstance(zeko);
  },

  getActiveInstance: async (args: {}) => {
    return JSON.stringify({ isZeko: state.isZeko });
  },

  loadContract: async (args: {}) => {
    const { FungibleToken, FungibleTokenAdmin, Faucet } = await import("../../../contracts/build/src/index");

    state.TokenStandard = FungibleToken;
    state.TokenAdmin = FungibleTokenAdmin;
    state.Faucet = Faucet
  },
  compileContract: async (args: {}) => {
    console.time("compile");
    await state.TokenAdmin?.compile({});
    await state.TokenStandard?.compile({});
    await state.Faucet!.compile({});

    console.timeEnd("compile");
  },
  fetchAccount: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    return await fetchAccount({ publicKey });
  },
  fetchAccountToken: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    return await fetchAccount({ publicKey, tokenId: state.zkToken?.deriveTokenId() });
  },
  getBalance: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    const balance = Mina.getBalance(publicKey);
    return JSON.stringify(balance.toJSON());
  },
  initZkappInstance: async (args: { token: string, faucet: string }) => {
    const token = PublicKey.fromBase58(args.token);
    await fetchAccount({ publicKey: token })
    state.zkToken = new state.TokenStandard!(token);

    const publicKeyFaucet = PublicKey.fromBase58(args.faucet);
    await fetchAccount({ publicKey: publicKeyFaucet, tokenId: state.zkToken.deriveTokenId() });
    state.zkFaucet = new state.Faucet!(publicKeyFaucet, state.zkToken.deriveTokenId());
  },
  claim: async (args: { user: string }) => {
    console.log("Network", Mina.getNetworkId());
    console.log("Graphql", Mina.activeInstance.getNetworkState);

    const publicKey = PublicKey.fromBase58(args.user);
    await fetchAccount({ publicKey: state.zkFaucet!.address });
    await fetchAccount({ publicKey: state.zkFaucet!.address, tokenId: state.zkToken!.deriveTokenId() });
    await fetchAccount({ publicKey });
    const acc = await fetchAccount({ publicKey, tokenId: state.zkToken?.deriveTokenId() });

    let newAcc = acc.account?.balance ? 0 : 1;
    const token = await state.zkFaucet?.token.fetch();
    console.log("token", token?.toBase58());
    const transaction = await Mina.transaction(publicKey, async () => {
      AccountUpdate.fundNewAccount(publicKey, newAcc);
      await state.zkFaucet!.claim();
      await state.zkToken?.approveAccountUpdate(state.zkFaucet!.self);
    });
    state.transaction = transaction;

    await state.transaction!.prove();
  },
  getTransactionJSON: async (args: {}) => {
    return state.transaction!.toJSON();
  },
  getKey: async (args: {}) => {
    return state.key;
  },
};

// ---------------------------------------------------------------------------------------

export type WorkerFunctions = keyof typeof functions;

export type ZkappWorkerRequest = {
  id: number;
  fn: WorkerFunctions;
  args: any;
};

export type ZkappWorkerReponse = {
  id: number;
  data: any;
  error: any;
};

if (typeof window !== "undefined") {
  addEventListener(
    "message",
    async (event: MessageEvent<ZkappWorkerRequest>) => {
      functions[event.data.fn](event.data.args).then(x => {
        const message: ZkappWorkerReponse = {
          id: event.data.id,
          data: x,
          error: null
        };
        postMessage(message);
      }).catch(x => {
        const messageError: ZkappWorkerReponse = {
          id: event.data.id,
          data: null,
          error: x
        };
        postMessage(messageError);
      });

    }
  );
}

console.log('Web Worker Successfully Initialized.');
