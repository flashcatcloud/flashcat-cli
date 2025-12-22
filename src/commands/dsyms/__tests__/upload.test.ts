import { UploadCommand } from "../upload";

describe("UploadCommand", () => {
  describe("parseDwarfdumpOutput", () => {
    it("should parse single architecture dwarfdump output", () => {
      const command = new UploadCommand();
      const output =
        "UUID: C8469F85-B060-3085-B69D-E46C645560EA (arm64) /path/to/MyApp.framework.dSYM/Contents/Resources/DWARF/MyApp";

      // @ts-ignore - accessing private method for testing
      const result = command.parseDwarfdumpOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        uuid: "C8469F85-B060-3085-B69D-E46C645560EA",
        arch: "arm64",
        objectPath:
          "/path/to/MyApp.framework.dSYM/Contents/Resources/DWARF/MyApp",
      });
    });

    it("should parse multiple architecture dwarfdump output", () => {
      const command = new UploadCommand();
      const output = `UUID: C8469F85-B060-3085-B69D-E46C645560EA (armv7) DDTest.framework.dSYM/Contents/Resources/DWARF/DDTest
UUID: 06EE3D68-D605-3E92-B92D-2F48C02A505E (arm64) DDTest.framework.dSYM/Contents/Resources/DWARF/DDTest`;

      // @ts-ignore - accessing private method for testing
      const result = command.parseDwarfdumpOutput(output);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        uuid: "C8469F85-B060-3085-B69D-E46C645560EA",
        arch: "armv7",
        objectPath: "DDTest.framework.dSYM/Contents/Resources/DWARF/DDTest",
      });
      expect(result[1]).toEqual({
        uuid: "06EE3D68-D605-3E92-B92D-2F48C02A505E",
        arch: "arm64",
        objectPath: "DDTest.framework.dSYM/Contents/Resources/DWARF/DDTest",
      });
    });

    it("should handle empty output", () => {
      const command = new UploadCommand();
      const output = "";

      // @ts-ignore - accessing private method for testing
      const result = command.parseDwarfdumpOutput(output);

      expect(result).toHaveLength(0);
    });

    it("should ignore invalid lines", () => {
      const command = new UploadCommand();
      const output = `Some random output
UUID: C8469F85-B060-3085-B69D-E46C645560EA (arm64) DDTest.framework.dSYM/Contents/Resources/DWARF/DDTest
Invalid line here
UUID: invalid format`;

      // @ts-ignore - accessing private method for testing
      const result = command.parseDwarfdumpOutput(output);

      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe("C8469F85-B060-3085-B69D-E46C645560EA");
    });
  });
});
