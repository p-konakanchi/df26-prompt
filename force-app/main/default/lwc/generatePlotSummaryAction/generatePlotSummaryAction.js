import { LightningElement, api } from 'lwc';
import { CloseActionScreenEvent } from 'lightning/actions';
import { getRecordNotifyChange } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import generatePlotSummary from '@salesforce/apex/MoviePlotSummaryController.generatePlotSummary';

export default class GeneratePlotSummaryAction extends LightningElement {
    _recordId;
    hasStarted = false;
    isLoading = false;

    // Quick-action LWCs don't have recordId populated yet by the time
    // connectedCallback runs (known platform limitation), so we use an
    // @api setter instead — it fires once the platform actually assigns
    // the value, which is when we kick off the Apex call.
    @api
    get recordId() {
        return this._recordId;
    }
    set recordId(value) {
        this._recordId = value;
        if (value && !this.hasStarted) {
            this.hasStarted = true;
            this.handleGenerate();
        }
    }

    async handleGenerate() {
        this.isLoading = true;
        try {
            const result = await generatePlotSummary({ movieId: this.recordId });
            if (result.errorMessage) {
                this.showToast('Error', result.errorMessage, 'error');
            } else {
                getRecordNotifyChange([{ recordId: this.recordId }]);
                this.showToast('Success', 'Plot summary generated.', 'success');
            }
        } catch (error) {
            this.showToast(
                'Error',
                error?.body?.message || 'Something went wrong while generating the plot summary.',
                'error'
            );
        } finally {
            this.isLoading = false;
            this.dispatchEvent(new CloseActionScreenEvent());
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}