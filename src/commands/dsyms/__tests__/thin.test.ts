import { promises } from "fs";
import os from "os";
import path from "path";

import { UploadCommand } from "../upload";
import * as utils from "../utils";

describe("UploadCommand thinDSYM", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await promises.mkdtemp(path.join(os.tmpdir(), "dsyms-thin-"));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await promises.rm(workDir, { recursive: true, force: true });
  });

  const makeBundle = async (objectNames: string[]) => {
    const bundlePath = path.join(workDir, "MyApp.app.dSYM");
    const dwarfDir = path.join(bundlePath, "Contents/Resources/DWARF");
    await promises.mkdir(dwarfDir, { recursive: true });
    for (const name of objectNames) {
      await promises.writeFile(path.join(dwarfDir, name), `content-of-${name}`);
    }

    return { bundlePath, dwarfDir };
  };

  it("copies each single-slice object file of a multi-object dSYM instead of running lipo", async () => {
    const { bundlePath, dwarfDir } = await makeBundle([
      "MyApp",
      "MyApp.debug.dylib",
    ]);
    const lipo = jest
      .spyOn(utils, "executeLipo")
      .mockRejectedValue(new Error("input file must be a fat file"));
    const dsym = {
      bundlePath,
      slices: [
        {
          arch: "arm64",
          uuid: "UUID-DYLIB",
          objectPath: path.join(dwarfDir, "MyApp.debug.dylib"),
        },
        {
          arch: "arm64",
          uuid: "UUID-MAIN",
          objectPath: path.join(dwarfDir, "MyApp"),
        },
      ],
    };
    const intermediate = path.join(workDir, "intermediate");

    const command = new UploadCommand();
    // @ts-ignore - accessing private method for testing
    const result = await command.thinDSYMs([dsym], intermediate);

    expect(lipo).not.toHaveBeenCalled();
    expect(result.map((d: any) => d.slices[0].uuid)).toEqual([
      "UUID-DYLIB",
      "UUID-MAIN",
    ]);
    expect(
      await promises.readFile(
        path.join(
          intermediate,
          "UUID-DYLIB.dSYM/Contents/Resources/DWARF/MyApp.debug.dylib"
        ),
        "utf8"
      )
    ).toBe("content-of-MyApp.debug.dylib");
    expect(
      await promises.readFile(
        path.join(
          intermediate,
          "UUID-MAIN.dSYM/Contents/Resources/DWARF/MyApp"
        ),
        "utf8"
      )
    ).toBe("content-of-MyApp");
  });

  it("extracts each arch of a fat object file with lipo", async () => {
    const { bundlePath, dwarfDir } = await makeBundle(["MyApp"]);
    const lipo = jest
      .spyOn(utils, "executeLipo")
      .mockResolvedValue({ stdout: "", stderr: "" } as any);
    const objectPath = path.join(dwarfDir, "MyApp");
    const dsym = {
      bundlePath,
      slices: [
        { arch: "armv7", uuid: "UUID-V7", objectPath },
        { arch: "arm64", uuid: "UUID-ARM64", objectPath },
      ],
    };

    const command = new UploadCommand();
    // @ts-ignore - accessing private method for testing
    const result = await command.thinDSYMs(
      [dsym],
      path.join(workDir, "intermediate")
    );

    expect(lipo).toHaveBeenCalledTimes(2);
    expect(lipo).toHaveBeenCalledWith(
      objectPath,
      "armv7",
      expect.stringContaining("UUID-V7.dSYM")
    );
    expect(lipo).toHaveBeenCalledWith(
      objectPath,
      "arm64",
      expect.stringContaining("UUID-ARM64.dSYM")
    );
    expect(result).toHaveLength(2);
  });
});
