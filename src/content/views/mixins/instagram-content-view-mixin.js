'use strict';

/**
 * A mixin that decorates an instance of ContentView 
 * to have a bounded visible set
 */
function asInstagramContentView(contentView, opts) {
    opts = opts || {};
    var elClass = opts.elClass || 'content-instagram';
    contentView.$el.addClass(elClass);

    /**
     * Render the content inside of the LivefyreContentView's element.
     * @returns {LivefyreContentView}
     */
    var oldRender = contentView.render;
    contentView.render = function () {
        oldRender.apply(contentView, arguments);
        contentView.$el.addClass(elClass);
    };

    contentView.events = contentView.events.extended({
        'imageError.hub': function (e, oembed) {
            this.remove();
        }
    });
};

module.exports = asInstagramContentView;
