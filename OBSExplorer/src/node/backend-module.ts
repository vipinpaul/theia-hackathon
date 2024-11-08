import { ContainerModule } from "@theia/core/shared/inversify";
import {
  ConnectionHandler,
  RpcConnectionHandler,
} from "@theia/core/lib/common/messaging";
import { FFmpegPath, FFmpegServer } from "../common/audio-backend-service";
import { FFmpegServerImpl } from "./audio-backend-module";

export default new ContainerModule((bind) => {
  bind(FFmpegServer).to(FFmpegServerImpl).inSingletonScope();
  bind(ConnectionHandler)
    .toDynamicValue(
      (ctx) =>
        new RpcConnectionHandler(FFmpegPath, () =>
          ctx.container.get<FFmpegServer>(FFmpegServer)
        )
    )
    .inSingletonScope();
});
