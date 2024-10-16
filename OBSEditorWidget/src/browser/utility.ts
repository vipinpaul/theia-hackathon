import URI from "@theia/core/lib/common/uri";

export const getWorkspacePath = (workspaceService: any): string | undefined => {
  const roots = workspaceService.tryGetRoots();
  if (roots.length > 0) {
    return roots[0].resource.path.toString();
  }
  return undefined;
};

export const createAndSaveFile = async (fileService: any, path: string, fileName: string = "newfile2.txt") => {
  const newFileUri = new URI(path).resolve(fileName);
  let fileExists;
  try {
    fileExists = await fileService.resolve(newFileUri);
  } catch {
    fileExists = undefined;
  }

  if (!fileExists) {
    await fileService.create(newFileUri);
    const content = "testing saving file";
    await fileService.write(newFileUri, content);
  }
};

export const getPath = (): string => {
  return "/d:/newfolder";
};
