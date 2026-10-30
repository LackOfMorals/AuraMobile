import { APP_NAME } from "../appName";
import { buildConnectionFile, connectionFileName, envValue } from "./connectionFile";

const details = {
  uri: "neo4j+s://d0000001.databases.neo4j.io",
  username: "neo4j",
  password: "s3cretPassw0rd",
  instanceId: "d0000001",
  instanceName: "orders-prod",
};
const when = new Date("2026-10-30T12:00:00.000Z");

/** A small reader for the file, to check it round-trips: KEY=value lines, with double-quoted values. */
function read(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of file.split("\n")) {
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    let v = line.slice(eq + 1);
    if (v.startsWith('"')) v = v.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    out[line.slice(0, eq)] = v;
  }
  return out;
}

describe("buildConnectionFile", () => {
  it("writes the same variable names the Aura console uses, and nothing else", () => {
    const keys = Object.keys(read(buildConnectionFile(details, when)));
    expect(keys).toEqual(["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD", "AURA_INSTANCEID", "AURA_INSTANCENAME"]);
  });

  it("holds the connection details exactly", () => {
    expect(read(buildConnectionFile(details, when))).toEqual({
      NEO4J_URI: details.uri,
      NEO4J_USERNAME: "neo4j",
      NEO4J_PASSWORD: "s3cretPassw0rd",
      AURA_INSTANCEID: "d0000001",
      AURA_INSTANCENAME: "orders-prod",
    });
  });

  it("starts with a warning that it holds a password, and says when and for what it was made", () => {
    const [first, second] = buildConnectionFile(details, when).split("\n");
    expect(first).toBe(`# Created by ${APP_NAME} on 2026-10-30T12:00:00.000Z for the Aura instance "orders-prod".`);
    expect(second).toMatch(/contains a database password.*do not commit/);
  });

  it("never puts the password in a comment", () => {
    const comments = buildConnectionFile(details, when).split("\n").filter((l) => l.startsWith("#")).join("\n");
    expect(comments).not.toContain(details.password);
  });

  it("round-trips a password with spaces, quotes, # and $ by quoting it", () => {
    const password = 'pa ss"w#rd$1\\x';
    const file = buildConnectionFile({ ...details, password }, when);
    expect(file).toContain('NEO4J_PASSWORD="pa ss\\"w#rd$1\\\\x"');
    expect(read(file).NEO4J_PASSWORD).toBe(password);
  });

  it("leaves a plain password unquoted, like the Aura console does", () => {
    expect(buildConnectionFile(details, when)).toContain("NEO4J_PASSWORD=s3cretPassw0rd\n");
  });

  it("cannot be made to add a line by an instance name with a newline in it", () => {
    const file = buildConnectionFile({ ...details, instanceName: "evil\nNEO4J_PASSWORD=stolen\r\n# x" }, when);
    expect(file.split("\n").filter((l) => l.startsWith("NEO4J_PASSWORD="))).toEqual(["NEO4J_PASSWORD=s3cretPassw0rd"]);
    expect(Object.keys(read(file))).toHaveLength(5);
  });

  it("ends with one newline", () => {
    expect(buildConnectionFile(details, when).endsWith("rdd\n")).toBe(false);
    expect(buildConnectionFile(details, when).endsWith("\n")).toBe(true);
    expect(buildConnectionFile(details, when).endsWith("\n\n")).toBe(false);
  });
});

describe("envValue", () => {
  it("quotes an empty value, so it is not read as missing", () => {
    expect(envValue("")).toBe('""');
  });
});

describe("connectionFileName", () => {
  it("is made of the instance's name and id", () => {
    expect(connectionFileName("orders-prod", "d0000001")).toBe(`${APP_NAME}-orders-prod-d0000001-connection.txt`);
  });
  it("keeps only safe characters, whatever the name holds", () => {
    const name = connectionFileName("../../My DB: prod/é\n", "id with spaces");
    expect(name).toMatch(new RegExp(`^${APP_NAME}-[A-Za-z0-9._-]+-connection\\.txt$`));
    expect(name).not.toContain("/");
  });
  it("copes with a name that has nothing usable in it", () => {
    expect(connectionFileName("日本語", "d1")).toBe(`${APP_NAME}-instance-d1-connection.txt`);
  });
  it("is never longer than a sensible name", () => {
    expect(connectionFileName("x".repeat(500), "y".repeat(500)).length).toBeLessThan(120);
  });
});
