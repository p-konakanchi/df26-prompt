import { LightningElement, api } from 'lwc';

const BADGE_CLASS_BY_RECOMMENDATION = {
    GO: 'ranked-movie-card__badge ranked-movie-card__badge_go',
    BACKUP: 'ranked-movie-card__badge ranked-movie-card__badge_backup',
    SKIP: 'ranked-movie-card__badge ranked-movie-card__badge_skip'
};

export default class RankedMovieCard extends LightningElement {
    @api name;
    @api year;
    @api genre;
    @api posterLink;
    @api plotSummary;
    @api status = 'loading'; // 'loading' | 'ready' | 'error'
    @api score;
    @api recommendation;
    @api reasoning;
    @api errorMessage;
    @api isTopPick = false;

    get isLoading() {
        return this.status === 'loading';
    }

    get hasError() {
        return this.status === 'error';
    }

    get isReady() {
        return this.status === 'ready';
    }

    get containerClass() {
        return this.isTopPick
            ? 'ranked-movie-card ranked-movie-card_top-pick'
            : 'ranked-movie-card';
    }

    get badgeClass() {
        return (
            BADGE_CLASS_BY_RECOMMENDATION[this.recommendation] ||
            'ranked-movie-card__badge'
        );
    }

    get badgeLabel() {
        if (!this.recommendation || this.score == null) {
            return '';
        }
        return `${this.recommendation} · ${this.score}/10`;
    }

    // Plot_Summary__c is now an HTML/Rich Text field, populated by the
    // Generate_Plot_Summary Flex template as a styled HTML snippet. This
    // card only wants a plain-text subtitle, so we parse the markup with
    // DOMParser and take the text content — no LLM re-call, no Apex
    // change, just a client-side presentational transform.
    get plainPlotSummary() {
        if (!this.plotSummary) {
            return this.plotSummary;
        }
        const doc = new DOMParser().parseFromString(this.plotSummary, 'text/html');
        return doc.body.textContent.replace(/\s+/g, ' ').trim();
    }
}