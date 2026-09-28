import { readConfig } from "./config";
import { createPool } from "./db";
import { createAccount, deleteAccount, issueRecoveryCode, revokeSessions, rotateRecoveryEpoch, setAccountDisabled, setAccountRole } from "./operator";
import { accountRoleSchema } from "./protocol";

function usage(): never {
  throw new Error("Usage: account <create|recovery|disable|enable|revoke|delete|role> <username> [display-name|role|--confirm username], or installation rotate-recovery --confirm ROTATE");
}

const [area, command, username, ...rest] = process.argv.slice(2);
if (!area || !command || !username) usage();
const pool = createPool(readConfig());
try {
  if (area === "installation" && command === "rotate-recovery") {
    const epoch = await rotateRecoveryEpoch(pool, username === "--confirm" ? rest[0] : undefined);
    process.stdout.write(`Recovery epoch rotated to ${epoch}; all sessions revoked.\n`);
  } else if (area !== "account") usage();
  else switch (command) {
    case "create": {
      const created = await createAccount(pool, username, rest.join(" ") || undefined);
      process.stdout.write(`Account ${created.accountId} created.\nSetup code (shown once, expires in 24 hours): ${created.code}\n`);
      break;
    }
    case "recovery": {
      const recovery = await issueRecoveryCode(pool, username);
      process.stdout.write(`Recovery code (shown once, expires in 24 hours): ${recovery.code}\n`);
      break;
    }
    case "disable":
      await setAccountDisabled(pool, username, true);
      process.stdout.write("Account disabled and sessions revoked.\n");
      break;
    case "enable":
      await setAccountDisabled(pool, username, false);
      process.stdout.write("Account enabled.\n");
      break;
    case "revoke":
      await revokeSessions(pool, username);
      process.stdout.write("Sessions revoked.\n");
      break;
    case "role": {
      if (rest.length !== 1) usage();
      const role = accountRoleSchema.parse(rest[0]);
      await setAccountRole(pool, username, role);
      process.stdout.write(`Account role changed to ${role}.\n`);
      break;
    }
    case "delete": {
      const flag = rest[0];
      const confirmation = rest[1];
      if (flag !== "--confirm" || rest.length !== 2) usage();
      await deleteAccount(pool, username, confirmation);
      process.stdout.write("Account and owned server data deleted. Offline browser copies cannot be remotely erased.\n");
      break;
    }
    default:
      usage();
  }
} finally {
  await pool.end();
}
