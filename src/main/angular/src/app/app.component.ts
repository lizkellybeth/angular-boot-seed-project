import { Component, OnDestroy, OnInit } from '@angular/core';
import { DataProvider } from './data-provider';
import { interval, Subscription } from 'rxjs';
import { MessageExchange } from './message-exchange';
import { RAW_TREE_NODE } from './raw-tree-nodes';
import { SimpleTreeNodeXmlAdapter } from './simple-tree-node-xml-adapter';
import { SimpleTreeNode } from './simple-tree/simple-tree-node';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {

    public timezone = { zoneId: 'UTC', zoneOffset: 'Z' };               // current timezone
    public datetime: string;                                            // current datetime
    public rawTreeNodes = [RAW_TREE_NODE];
    public xmlTree: SimpleTreeNode[];
    private subscription: Subscription;

    /**
     * Launch a background loop repeating a task
     *
     * @param task   The task to execute (a void function taking a numerical parameter, the iteration number)
     * @param delay  Time to wait between two iterations of the loop, in milliseconds
     */
    private static launchBackgroundLoop( task: any, delay: number ): Subscription {
        const source = interval( delay );
        return source.subscribe( task );
    }

    constructor( public dataProvider: DataProvider,
                 public mx: MessageExchange ) {
        // no-op
    }

    ngOnInit(): void {

        this.loadXmlFile();

        this.mx.subscribe( message => {
            console.log('>>> AppComponent received:', message.type);
            if (message.type === MessageExchange.GLOBAL_CONFIG_AVAILABLE ) {
                this.subscription = AppComponent.launchBackgroundLoop( this.updateClock( this ), 1_000 );
            } else if (message.type === MessageExchange.CURRENT_TIMEZONE ) {
                this.timezone = message.currentTimezone;
            }
        });

        // Fetch global configuration information
        this.dataProvider.fetchGlobalConfiguration();
    }

    /**
     * Define the background task getting the current time from the server. The task (a function) executes
     * in a different context and it will not have access to the component via 'this', so we need to return
     * a closure including this component.
     *
     * @param component  This component (to build the closure)
     *
     * @return A void function taking a numerical parameter (the iteration number). It invokes the server's
     *         /datetime endpoint and saves the response to this component's 'datetime' field.
     */
    private updateClock( component: AppComponent ): () => void {
        return () => {
            component.dataProvider.fetchCurrentTime( component.timezone.zoneId )
                .then(response => {
                    const datetimeFieldName = 'datetime';
                    return component.datetime = response[datetimeFieldName];
                })
                .catch(reason => console.error(reason));
        };
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }

    // Fetch all startup information from the backend server
    public renderDatetime(): string {
        if ( this.datetime === undefined ) {
            return '(not available)';
        }
        return this.datetime.replace( 'T', ' ' ).split('\.')[0];
    }

    renderTimezone() {
        const offset = this.timezone.zoneOffset === 'Z' ? '' : ' (' + this.timezone.zoneOffset + ')';
        return this.timezone.zoneId + offset;
    }

    loadXmlFile() {
        this.dataProvider.fetchXmlFile()
            .then( data =>
                this.xmlTree = [ SimpleTreeNodeXmlAdapter.fromXml( data ) ]
            )
            .catch( error =>
                alert(
                    JSON.stringify( error )
                ));
    }
}
