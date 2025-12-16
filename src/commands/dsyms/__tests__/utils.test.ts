import { isZipFile, pluralize } from "../utils";

describe("utils", () => {
  describe("pluralize", () => {
    it("should return singular form for 0", () => {
      expect(pluralize(0, "file", "files")).toBe("0 file");
    });

    it("should return singular form for 1", () => {
      expect(pluralize(1, "file", "files")).toBe("1 file");
    });

    it("should return plural form for 2", () => {
      expect(pluralize(2, "file", "files")).toBe("2 files");
    });

    it("should return plural form for numbers greater than 2", () => {
      expect(pluralize(10, "file", "files")).toBe("10 files");
    });
  });

  describe("isZipFile", () => {
    it("should return false for non-existent file", async () => {
      const result = await isZipFile("/non/existent/file.zip");
      expect(result).toBe(false);
    });

    it("should return false for file without .zip extension", async () => {
      const result = await isZipFile(__filename);
      expect(result).toBe(false);
    });
  });
});
