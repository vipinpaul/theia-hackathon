import { ContainerModule } from "@theia/core/shared/inversify";
import { OBSEditorWidgetWidget } from "./OBSEditorWidget-widget";
import { OBSEditorWidgetContribution } from "./OBSEditorWidget-contribution";
import {
  bindViewContribution,
  FrontendApplicationContribution,
  WidgetFactory,
} from "@theia/core/lib/browser";
import "../../src/browser/style/index.css";
import { WorkspaceService } from "@theia/workspace/lib/browser";
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import URI from '@theia/core/lib/common/uri';

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

        
        const createAndSaveFile = async (workspacePath: string) => {
          console.log(workspacePath,URI,"checkingg")
          const newFileUri = new URI(workspacePath + "/check").resolve('newfile.txt');
          console.log(workspacePath,newFileUri,"checkingg")
          
          
          let fileExists;
          try {
            fileExists = await fileService.resolve(newFileUri);
          } catch {
            fileExists = undefined;
          }

          
          if (!fileExists) {
            console.log(`Creating file at: ${newFileUri.toString()}`);

            
            await fileService.create(newFileUri);

            
            const content = 'testing saving file'; 
            await fileService.write(newFileUri, content);

            console.log('File created and saved successfully.');
          } else {
            console.log('File already exists.');
          }
        };

        
        workspaceService.onWorkspaceChanged(() => {
          const roots = workspaceService.tryGetRoots();
          console.log(roots,"gettt")
          if (roots.length > 0) {
            const workspacePath = roots[0].resource.path.toString();
            console.log('Get Workspace Path:', workspacePath);

            
            createAndSaveFile(workspacePath);
          } else {
            console.log('No workspace is open.');
          }
        });

        
        const roots = workspaceService.tryGetRoots();
        if (roots.length > 0) {
            console.log("rootes",roots)
          const workspacePath = roots[0].resource.path.toString();
          console.log('Check Workspace Path:', workspacePath);

          
          await createAndSaveFile(workspacePath);
        } else {
          console.log('No workspace is open.');
        }

        
        return ctx.container.get<OBSEditorWidgetWidget>(OBSEditorWidgetWidget);
      },
    }))
    .inSingletonScope();
});
