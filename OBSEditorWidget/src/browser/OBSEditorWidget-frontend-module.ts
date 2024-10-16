import { ContainerModule } from "@theia/core/shared/inversify";
import { OBSEditorWidgetWidget } from "./OBSEditorWidget-widget";
import { OBSEditorWidgetContribution } from "./OBSEditorWidget-contribution";
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from "@theia/core/lib/browser";
import { WorkspaceService } from "@theia/workspace/lib/browser";
import { FileService } from "@theia/filesystem/lib/browser/file-service";
import { createAndSaveFile, getWorkspacePath } from "./utility";

export default new ContainerModule((bind) => {
  bindViewContribution(bind, OBSEditorWidgetContribution);
  bind(FrontendApplicationContribution).toService(OBSEditorWidgetContribution);
  bind(OBSEditorWidgetWidget).toSelf();

  bind(WidgetFactory)
    .toDynamicValue((ctx) => ({
      id: OBSEditorWidgetWidget.ID,
      createWidget: async () => {
        const workspaceService = ctx.container.get<WorkspaceService>(WorkspaceService);
        const fileService = ctx.container.get<FileService>(FileService);

        workspaceService.onWorkspaceChanged(() => {
          const workspacePath = getWorkspacePath(workspaceService);
          if (workspacePath) {
            createAndSaveFile(fileService, workspacePath);
          }
        });

        const workspacePath = getWorkspacePath(workspaceService);
        if (workspacePath) {
          await createAndSaveFile(fileService, workspacePath);
        }

        return ctx.container.get<OBSEditorWidgetWidget>(OBSEditorWidgetWidget);
      },
    }))
    .inSingletonScope();
});
