import nacl from "tweetnacl";
import { encodeUTF8, decodeBase64 } from "tweetnacl-util";

export const decryptMessage = ({
  messageContent,
  sender,
  privateKey,
  currentUserId,
  recipientPublicKey,
}) => {
  if (!messageContent || !privateKey || !sender) {
    return "...";
  }

  try {
    const messageData = JSON.parse(messageContent);
    const nonce = decodeBase64(messageData.nonce);
    const encryptedMessage = decodeBase64(messageData.message);

    let publicKeyToUse;
    if (sender._id === currentUserId) {
      publicKeyToUse = recipientPublicKey;
    } else {
      publicKeyToUse = decodeBase64(sender.publicKey);
    }

    if (!publicKeyToUse) {
      return "Decrypting...";
    }

    const decrypted = nacl.box.open(
      encryptedMessage,
      nonce,
      publicKeyToUse,
      privateKey
    );

    if (decrypted === null) {
      return "Unable to decrypt message";
    }
    return encodeUTF8(decrypted);
  } catch (e) {
    console.error("Could not decrypt message", e);
    return "Could not decrypt message.";
  }
};

export const decryptGroupMessage = ({ messageContent, groupKey }) => {
  if (!messageContent || !groupKey) {
    return "...";
  }
  try {
    let messageData = messageContent;
    if (typeof messageData === "string") {
      messageData = JSON.parse(messageData);
      if (typeof messageData === "string") {
        messageData = JSON.parse(messageData);
      }
    }
    if (!messageData || !messageData.nonce || !messageData.message) {
      return "Could not decrypt message.";
    }
    const nonce = decodeBase64(messageData.nonce);
    const encryptedMessage = decodeBase64(messageData.message);
    const decrypted = nacl.secretbox.open(encryptedMessage, nonce, groupKey);

    if (decrypted === null) {
      return "Unable to decrypt message";
    }
    return encodeUTF8(decrypted);
  } catch (e) {
    console.error("Could not decrypt group message", e);
    return "Could not decrypt message.";
  }
};
