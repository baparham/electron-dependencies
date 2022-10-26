export function expectAllStrings(expectedStrings: string[], fileContent: string) {
  for (const expected of expectedStrings) {
    expect(fileContent).toContain(expected);
  }
}
