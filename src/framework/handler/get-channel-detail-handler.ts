import {CachedItemRequestSourceFrom, CachedItemStore} from '../../key-value-store';
import {FileService} from '../../util/file/def/file-service';
import {Path} from '../../util/file/util/path';
import {Channel, ChannelDetailsRequest, FrameworkServiceConfig} from '..';
import {ApiRequestHandler, ApiService, HttpRequestType, Request} from '../../api';
import {defer, from, iif, Observable} from 'rxjs';
import {map} from 'rxjs/operators';


export class GetChannelDetailsHandler implements ApiRequestHandler<ChannelDetailsRequest, Channel> {
    private readonly CHANNEL_FILE_KEY_PREFIX = 'channel-';
    private readonly CHANNEL_LOCAL_KEY = 'channel-';
    private readonly GET_FRAMEWORK_DETAILS_ENDPOINT = '/read';


    constructor(private apiService: ApiService,
                private frameworkServiceConfig: FrameworkServiceConfig,
                private fileService: FileService,
                private cachedItemStore: CachedItemStore) {
    }

    handle(request: ChannelDetailsRequest): Observable<Channel> {
        return this.cachedItemStore[request.from === CachedItemRequestSourceFrom.SERVER ? 'get' : 'getCached'](
            request.channelId,
            this.CHANNEL_LOCAL_KEY,
            'ttl_' + this.CHANNEL_LOCAL_KEY,
            () => this.fetchFromServer(request),
            () => this.fetchFromFile(request)
        ).pipe(
            map((channel: Channel) => {
                if (channel.frameworks) {
                    const maxIndex: number = channel.frameworks.reduce((acc, val) => (val.index && (val.index > acc)) ? val.index : acc, 0);

                    channel.frameworks.sort((i, j) => (i.index || maxIndex + 1) - (j.index || maxIndex + 1));
                }
                return channel;
            })
        );
    }

    private fetchFromServer(request: ChannelDetailsRequest): Observable<Channel> {
        const apiRequest: Request = new Request.Builder()
            .withType(HttpRequestType.GET)
            .withPath(this.frameworkServiceConfig.channelApiPath + this.GET_FRAMEWORK_DETAILS_ENDPOINT + '/' + request.channelId)
            .withApiToken(true)
            .build();

        return this.apiService.fetch<{ result: { channel: Channel } }>(apiRequest).pipe(
            map((response) => {
                return response.body.result.channel;
            })
        );
    }

    private fetchFromFile(request: ChannelDetailsRequest): Observable<Channel> {
        const dir = Path.ASSETS_PATH + this.frameworkServiceConfig.channelConfigDirPath;
        const file = this.CHANNEL_FILE_KEY_PREFIX + request.channelId + '.json';

        return from(this.fileService.readFileFromAssets(dir.concat('/', file))).pipe(
            map((filecontent: string) => {
                const result = JSON.parse(filecontent);
                return (result.result.channel);
            })
        );
    }

}
