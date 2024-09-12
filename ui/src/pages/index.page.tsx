
import Head from 'next/head';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import styles from '../styles/Home.module.css';
import heroMinaLogo from '../../public/assets/hero-mina-logo.svg';
import arrowRightSmall from '../../public/assets/arrow-right-small.svg';
import ZkappWorkerClient from './zkappWorkerClient';
import { PublicKey } from 'o1js';
import Faucet from '@/components/Faucet';
import Account from '@/components/Account';

export default function Home() {
  const faucetAddress = 'B62qrcjVWC5H4mkhJjLhBfWXx1hRP7F2dUt57QouaZ6ABZh48DD6wgP';
  const tokenAddress = 'B62qnPKGpfthW2gbKf8Z2QxRokF8w354ui1oPWBWePHoHk5opPuEM6V';

  const [state, setState] = useState({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasWallet: null as null | boolean,
    hasBeenSetup: false,
    accountExists: false,
    publicKey: null as null | PublicKey,
    zkFaucetPublicKey: null as null | PublicKey,
    creatingTransaction: false,
  });

  const [displayText, setDisplayText] = useState('');
  const [transactionlink, setTransactionLink] = useState('');

  // -------------------------------------------------------
  // Do Setup

  useEffect(() => {
    async function timeout(seconds: number): Promise<void> {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, seconds * 1000);
      });
    }

    (async () => {
      if (!state.hasBeenSetup) {
        setDisplayText('Loading web worker...');
        console.log('Loading web worker...');
        const zkappWorkerClient = new ZkappWorkerClient();
        await timeout(1);

        setDisplayText('Done loading web worker');
        console.log('Done loading web worker');

        await zkappWorkerClient.setActiveInstanceToDevnet();

        await zkappWorkerClient.loadContract();


        console.log('Compiling zkApp...');
        setDisplayText('Compiling zkApp...');
        await zkappWorkerClient.compileContract();
        console.log('zkApp compiled');
        setDisplayText('zkApp compiled...');

        const zkTokenPublicKey = PublicKey.fromBase58(tokenAddress);
        const zkFaucetPublicKey = PublicKey.fromBase58(faucetAddress);

        await zkappWorkerClient.initZkappInstance(zkTokenPublicKey, zkFaucetPublicKey);

        setDisplayText('');

        setState({
          ...state,
          zkappWorkerClient,
          hasWallet: true,
          hasBeenSetup: true,
          zkFaucetPublicKey,
        });
      }
    })();
  }, []);

  // -------------------------------------------------------
  // Create UI elements


  const stepDisplay = transactionlink ? (
    <a
      href={transactionlink}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: 'underline' }}
    >
      View transaction
    </a>
  ) : (
    displayText
  );

  let setup = (
    <div
      className={styles.start}
      style={{ fontWeight: 'bold', fontSize: '1.5rem', paddingBottom: '5rem' }}
    >
      {stepDisplay}
    </div>
  );



  let mainContent = (
    <div style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Account accountState={state}></Account>
      {state.hasBeenSetup && <Faucet accountState={state}></Faucet>}
    </div>
  );



  return (
    <div className={styles.main} style={{ padding: 0 }}>
      <div className={styles.center} style={{ padding: 0 }}>
        {setup}
        {mainContent}
      </div>
    </div>
  );
}
