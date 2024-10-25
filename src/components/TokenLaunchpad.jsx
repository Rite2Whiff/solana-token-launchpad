import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { UploadClient } from "@uploadcare/upload-client";
import {
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  createInitializeMetadataPointerInstruction,
  TYPE_SIZE,
  LENGTH_SIZE,
  ExtensionType,
  createInitializeMintInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import { createInitializeInstruction, pack } from "@solana/spl-token-metadata";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";

export function TokenLaunchpad() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const client = new UploadClient({
    publicKey: "fccdbf5ae649d1e3bdfe", // Your public key directly
  });
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [supply, setSupply] = useState(0);

  const createUploadMetadata = async (name, symbol, image) => {
    const metadata = JSON.stringify({
      name,
      symbol,
      image,
    });

    const metadataFile = new File([metadata], "metadata.json", {
      type: "application/json",
    });

    try {
      const result = await client.uploadFile(metadataFile);
      return result.cdnUrl;
    } catch (error) {
      console.error("Upload failed:", error);
      throw error;
    }
  };

  async function createToken() {
    const mintKeypair = Keypair.generate();

    const dynamicUri = await createUploadMetadata(name, symbol, imageUrl);

    const metadata = {
      mint: mintKeypair.publicKey,
      name: name,
      symbol: symbol,
      uri: dynamicUri,
      additionalMetadata: [],
    };

    const mintLen = getMintLen([ExtensionType.MetadataPointer]);
    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

    const lamports = await connection.getMinimumBalanceForRentExemption(
      mintLen + metadataLen
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMetadataPointerInstruction(
        mintKeypair.publicKey,
        wallet.publicKey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        9,
        wallet.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        mint: mintKeypair.publicKey,
        metadata: mintKeypair.publicKey,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        mintAuthority: wallet.publicKey,
        updateAuthority: wallet.publicKey,
      })
    );

    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    transaction.partialSign(mintKeypair);

    await wallet.sendTransaction(transaction, connection);

    console.log(`Token mint created at ${mintKeypair.publicKey.toBase58()}`);
    const associatedToken = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    console.log(associatedToken.toBase58());

    const transaction2 = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        associatedToken,
        wallet.publicKey,
        mintKeypair.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    );

    await wallet.sendTransaction(transaction2, connection);

    const tokenSupply = parseInt(supply);

    const transaction3 = new Transaction().add(
      createMintToInstruction(
        mintKeypair.publicKey,
        associatedToken,
        wallet.publicKey,
        tokenSupply,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    await wallet.sendTransaction(transaction3, connection);

    alert(
      `Total of ${supply} were minted by ${mintKeypair.publicKey} at ${associatedToken} `
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <h1>Solana Token Launchpad</h1>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="inputText"
        type="text"
        placeholder="Name"
      ></input>
      <br />
      <input
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        className="inputText"
        type="text"
        placeholder="Symbol"
      ></input>
      <br />
      <input
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        className="inputText"
        type="text"
        placeholder="Image URL"
      ></input>
      <br />
      <input
        value={supply}
        onChange={(e) => setSupply(e.target.value)}
        className="inputText"
        type="text"
        placeholder="Initial Supply"
      ></input>{" "}
      <br />
      <button onClick={createToken} className="btn">
        Create a token
      </button>
    </div>
  );
}
