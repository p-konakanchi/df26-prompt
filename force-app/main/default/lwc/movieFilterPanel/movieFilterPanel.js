import { LightningElement, wire } from 'lwc';
import getGenreOptions from '@salesforce/apex/MovieFilterController.getGenreOptions';
import findMovies from '@salesforce/apex/MovieFilterController.findMovies';
import generateMovieCard from '@salesforce/apex/RankMovieController.generateMovieCard';

const YEAR_OPTIONS = [
    { label: '2020 and later', value: '2020' },
    { label: '2010 and later', value: '2010' },
    { label: '2000 and later', value: '2000' },
    { label: 'All time', value: '0' }
];

export default class MovieFilterPanel extends LightningElement {
    yearOptions = YEAR_OPTIONS;
    selectedYear = '0';
    selectedGenres = [];
    genreOptions = [];

    movies = [];
    hasSearched = false;
    isLoading = false;
    errorMessage;
    showResults = false;
    selectedMovieIds = [];

    showRanking = false;
    rankedMovies = [];

    @wire(getGenreOptions)
    wiredGenres({ data, error }) {
        if (data) {
            this.genreOptions = data.map((genre) => ({
                label: genre,
                value: genre
            }));
        } else if (error) {
            this.errorMessage = 'Unable to load genres.';
        }
    }

    handleYearChange(event) {
        this.selectedYear = event.detail.value;
    }

    // Previous dual-listbox change handler — kept in case we switch back.
    // handleGenreChange(event) {
    //     this.selectedGenres = event.detail.value;
    // }

    handleGenreAdd(event) {
        const genre = event.detail.value;
        if (genre && !this.selectedGenres.includes(genre)) {
            this.selectedGenres = [...this.selectedGenres, genre];
        }
    }

    handleGenreRemove(event) {
        const removedGenre = event.detail.item.name;
        this.selectedGenres = this.selectedGenres.filter(
            (genre) => genre !== removedGenre
        );
    }

    get availableGenreOptions() {
        return this.genreOptions.filter(
            (option) => !this.selectedGenres.includes(option.value)
        );
    }

    get selectedGenrePills() {
        return this.selectedGenres.map((genre) => ({
            type: 'icon',
            name: genre,
            label: genre,
            iconName: 'custom:custom45',
            alternativeText: genre
        }));
    }

    async handleFindMovies() {
        this.isLoading = true;
        this.errorMessage = undefined;
        this.hasSearched = true;
        try {
            const minYear = parseInt(this.selectedYear, 10);
            const result = await findMovies({
                minYear: minYear > 0 ? minYear : null,
                genres:
                    this.selectedGenres.length > 0
                        ? this.selectedGenres
                        : null
            });
            this.movies = result.map((movie) => ({
                id: movie.Id,
                name: movie.Name,
                year: movie.Year__c,
                genre: movie.Genre__c,
                posterLink: movie.Poster_Link__c,
                plotSummary: movie.Plot_Summary__c,
                selected: false,
                cardClass: 'movie-card'
            }));
            this.selectedMovieIds = [];
            this.showResults = this.movies.length > 0;
        } catch (error) {
            this.errorMessage =
                error?.body?.message || 'Something went wrong while searching for movies.';
            this.movies = [];
        } finally {
            this.isLoading = false;
        }
    }

    handleBackToSearch() {
        this.showResults = false;
    }

    handleMovieToggle(event) {
        const movieId = event.currentTarget.dataset.id;
        this.movies = this.movies.map((movie) => {
            if (movie.id !== movieId) {
                return movie;
            }
            const selected = !movie.selected;
            return {
                ...movie,
                selected,
                cardClass: selected ? 'movie-card movie-card_selected' : 'movie-card'
            };
        });
        this.selectedMovieIds = this.movies
            .filter((movie) => movie.selected)
            .map((movie) => movie.id);
    }

    handleRankThese() {
        const selectedMovies = this.movies.filter((movie) => movie.selected);

        // Seed the ranking screen with a loading card per selected movie,
        // then fire one independent Apex call per movie in parallel. Cards
        // update in place as each call resolves — they will NOT all land
        // at the same time, by design (see design doc UI Flow, step 5).
        this.rankedMovies = selectedMovies.map((movie) => ({
            id: movie.id,
            name: movie.name,
            year: movie.year,
            genre: movie.genre,
            posterLink: movie.posterLink,
            plotSummary: movie.plotSummary,
            status: 'loading',
            score: undefined,
            recommendation: undefined,
            reasoning: undefined,
            errorMessage: undefined,
            isTopPick: false
        }));
        this.showRanking = true;

        selectedMovies.forEach((movie) => {
            generateMovieCard({ movieId: movie.id })
                .then((result) => {
                    this.updateRankedMovie(movie.id, {
                        status: result.errorMessage ? 'error' : 'ready',
                        score: result.score,
                        recommendation: result.recommendation,
                        reasoning: result.reasoning,
                        errorMessage: result.errorMessage
                    });
                })
                .catch((error) => {
                    this.updateRankedMovie(movie.id, {
                        status: 'error',
                        errorMessage:
                            error?.body?.message ||
                            'Something went wrong while scoring this movie.'
                    });
                })
                .finally(() => {
                    this.maybeHighlightTopPick();
                });
        });
    }

    updateRankedMovie(movieId, changes) {
        this.rankedMovies = this.rankedMovies.map((movie) =>
            movie.id === movieId ? { ...movie, ...changes } : movie
        );
    }

    maybeHighlightTopPick() {
        const stillPending = this.rankedMovies.some(
            (movie) => movie.status === 'loading'
        );
        if (stillPending) {
            return;
        }

        // All calls have settled (ready or error) — sort by score
        // descending and highlight the top-scoring GO/BACKUP pick.
        // This is plain client-side JS, not a Prompt Builder feature.
        const scored = this.rankedMovies.filter(
            (movie) => movie.status === 'ready' && movie.score != null
        );
        if (scored.length === 0) {
            return;
        }
        const topMovieId = scored.reduce((best, movie) =>
            movie.score > best.score ? movie : best
        ).id;

        this.rankedMovies = [...this.rankedMovies]
            .sort((a, b) => {
                if (a.score == null) return 1;
                if (b.score == null) return -1;
                return b.score - a.score;
            })
            .map((movie) => ({
                ...movie,
                isTopPick: movie.id === topMovieId
            }));
    }

    handleBackToResultsFromRanking() {
        this.showRanking = false;
        this.rankedMovies = [];
    }

    get hasNoResults() {
        return this.hasSearched && !this.isLoading && this.movies.length === 0;
    }

    get isRankDisabled() {
        return this.selectedMovieIds.length === 0;
    }

    // The search screen reads best as a narrow, centered form; the
    // results/ranking screens want to use the full available width for
    // the poster grid and horizontal ranking rows.
    get pageClass() {
        return this.showResults
            ? 'slds-p-around_medium movie-filter-page movie-filter-page_wide'
            : 'slds-p-around_medium movie-filter-page';
    }
}