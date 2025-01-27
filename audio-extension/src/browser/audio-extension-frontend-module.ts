import { ContainerModule } from "@theia/core/shared/inversify";
import {
  bindViewContribution,
  FrontendApplicationContribution,
  WidgetFactory,
} from "@theia/core/lib/browser";
import { AudioContribution } from "./audio-extension-contribution";
import { AudioWidget } from "./audio-widget";

export default new ContainerModule((bind) => {

  bindViewContribution(bind, AudioContribution);
  bind(FrontendApplicationContribution).toService(AudioContribution);

  bind(AudioWidget).toSelf();

  bind(WidgetFactory)
    .toDynamicValue((ctx) => {
      return {
        id: AudioWidget.ID,
        createWidget: () => {
          return ctx.container.get<AudioWidget>(AudioWidget);
        },
      };
    })
    .inSingletonScope();
});
