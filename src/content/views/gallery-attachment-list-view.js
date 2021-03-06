define([
    'streamhub-sdk/jquery',
    'streamhub-sdk/view',
    'streamhub-sdk/content/views/tiled-attachment-list-view',
    'streamhub-sdk/content/views/oembed-view',
    'hgn!streamhub-sdk/content/templates/gallery-attachment-list',
    'streamhub-sdk/content/content-header-view-factory',
    'streamhub-sdk/content/views/sandbox',
    'inherits'],
    function ($, View, TiledAttachmentListView, OembedView, GalleryAttachmentListTemplate, ContentHeaderViewFactory, Sandbox, inherits) {
        'use strict';

        var AUTOPLAY_PROVIDER_REGEX = /youtube|livefyre|facebook/;

        /**
         * A view that displays a content's attachments as a gallery
         *
         * @param opts {Object} A set of options to config the view with
         * @param opts.el {HTMLElement} The element in which to render the streamed content
         * @param opts.content {Content} The content containing attachments to display as a gallery
         * @param opts.attachmentToFocus {Oembed} The attachment to focus in the gallery
         * @param opts.userInfo {boolean} Whether to display the user info
         * @param opts.pageButtons {boolean} Whether to display next/previous page buttons
         * @param opts.pageCount {boolean} Whether to display the page count/index
         * @param opts.thumbnails {boolean} Whether to display the thumbnails of all attachments
         * @param opts.proportionalThumbnails {boolean} Whether the thumbnail widths are proportional to the gallery container
         * @fires GalleryAttachmentListView#hideModal.hub
         * @exports streamhub-sdk/views/gallery-attachment-list-view
         * @constructor
         */
        var GalleryAttachmentListView = function (opts) {
            opts = opts || {};
            View.call(this, opts);

            this.userInfo = opts.userInfo === undefined ? true : opts.userInfo;
            this.pageButtons = opts.pageButtons === undefined ? true : opts.pageButtons;
            this.pageCount = opts.pageCount === undefined ? true : opts.pageCount;
            this.thumbnails = opts.thumbnails === undefined ? false : opts.thumbnails;
            this.proportionalThumbnails = opts.proportionalThumbnails === undefined ? false : opts.proportionalThumbnails;
            this.focusedIndex = 0;
            this.oembedViews = [];
            this._contentHeaderViewFactory = new ContentHeaderViewFactory();

            if (opts.content) {
                this.setContent(opts.content);
            }

            if (opts.attachmentToFocus) {
                this.setFocusedAttachment(opts.attachmentToFocus);
            }

            var self = this;
            $(window).on('resize', function (e) {
                self.resizeFocusedAttachment();
            });

            $(window).on('keyup', function (e) {
                e.preventDefault();
                if (!self.pageButtons) {
                    return;
                }
                if (e.keyCode === 37) {
                    // left arrow
                    self.prev();
                } else if (e.keyCode === 39) {
                    // right arrow
                    self.next();
                }
            });
        };
        inherits(GalleryAttachmentListView, View);
        $.extend(GalleryAttachmentListView.prototype, TiledAttachmentListView.prototype);

        GalleryAttachmentListView.prototype.template = GalleryAttachmentListTemplate;
        GalleryAttachmentListView.prototype.attachmentsGallerySelector = '.content-attachments-gallery';
        GalleryAttachmentListView.prototype.focusedAttachmentsSelector = '.content-attachments-gallery-focused';
        GalleryAttachmentListView.prototype.galleryThumbnailsSelector = '.content-attachments-gallery-thumbnails';
        GalleryAttachmentListView.prototype.galleryPrevSelector = '.content-attachments-gallery-prev';
        GalleryAttachmentListView.prototype.galleryNextSelector = '.content-attachments-gallery-next';
        GalleryAttachmentListView.prototype.galleryCloseSelector = '.content-attachments-gallery-close';
        GalleryAttachmentListView.prototype.galleryCountSelector = '.content-attachments-gallery-count';
        GalleryAttachmentListView.prototype.galleryCurrentPageSelector = '.content-attachments-gallery-current-page';
        GalleryAttachmentListView.prototype.galleryTotalPagesSelector = '.content-attachments-gallery-total-pages';
        GalleryAttachmentListView.prototype.focusedAttachmentClassName = 'content-attachments-focused';
        GalleryAttachmentListView.prototype.attachmentMetaSelector = '.content-attachments-meta';
        GalleryAttachmentListView.prototype.actualImageSelector = '.content-attachment-actual-image';

        GalleryAttachmentListView.prototype.events = TiledAttachmentListView.prototype.events.extended({
            click: function (e) {
                // If the click was on the focused attachment, don't hide the modal.
                // In Chrome, the videos in iframes will never trigger this handler,
                // but Firefox will. Also, non-iframe videos will always be handled
                // by this.
                if ($(e.target).parent().closest('.' + this.focusedAttachmentClassName).length) {
                    return;
                }

                /**
                 * Hide modal
                 * @event GalleryAttachmentListView#hideModal.hub
                 */
                this.$el.trigger('hideModal.hub');
            },
            'focusContent.hub': function (e, context) {
                if (context.content) {
                    for (var i = 0; i < context.content.attachments; i++) {
                        this.add(context.content.attachments[i]);
                    }
                }
                this.setFocusedAttachment(context.attachmentToFocus);
                this.render();
            }
        }, function (events) {
            var pagingSelectors = [
                this.attachmentMetaSelector,
                this.galleryNextSelector,
                this.galleryPrevSelector,
                this.actualImageSelector
            ].join(',');

            events['click ' + pagingSelectors] = function (e) {
                e.stopPropagation();
                if (!this.pageButtons) {
                    return;
                }
                if ($(e.currentTarget).hasClass(this.galleryNextSelector.substring(1)) || $(e.currentTarget).hasClass(this.actualImageSelector.substring(1))) {
                    this.next();
                } else if ($(e.currentTarget).hasClass(this.galleryPrevSelector.substring(1))) {
                    this.prev();
                }
            };
        });

        /**
         * Set the attachment instance to be displayed as the focused item in the gallery
         * @param element {Oembed} The attachment to focus in the gallery
         */
        GalleryAttachmentListView.prototype.setFocusedAttachment = function (attachment) {
            attachment = attachment.el ? attachment.oembed : attachment;
            this._focusedAttachment = attachment;
        };

        /**
         * Set the element for the view to render in.
         * You will probably want to call .render() after this, but not always.
         * @param element {HTMLElement} The element to render this View in
         * @returns this
         */
        GalleryAttachmentListView.prototype.setElement = function (element) {
            return View.prototype.setElement.call(this, element);
        };

        /**
         * Creates DOM structure of gallery to be displayed
         */
        GalleryAttachmentListView.prototype.render = function () {
            TiledAttachmentListView.prototype.render.call(this);

            var attachmentsGalleryEl = this.$el.find(this.attachmentsGallerySelector);
            var self = this;
            $.each(this.oembedViews, function (i, oembedView) {
                oembedView.$el.appendTo(attachmentsGalleryEl.find(self.galleryThumbnailsSelector));
                oembedView.$el.on('click', function (e) {
                    $(e.target).trigger('focusContent.hub', { content: self.content, attachmentToFocus: oembedView.oembed });
                });
                oembedView.render();
            });

            var contentMetaEl = this.$el.find(this.attachmentMetaSelector);
            contentMetaEl[this.userInfo ? 'show' : 'hide']();

            var pageButtonEls = this.$el.find([this.galleryPrevSelector, this.galleryNextSelector].join(','));
            pageButtonEls[this.pageButtons ? 'show' : 'hide']();

            var pageCountEl = this.$el.find(this.galleryCountSelector);
            pageCountEl[this.pageCount ? 'show' : 'hide']();

            var thumbnailsEl = this.$el.find(this.galleryThumbnailsSelector);

            if (this.proportionalThumbnails) {
                var thumbnailTileEls = thumbnailsEl.children();
                for (var i = 0; i < thumbnailTileEls.length; i++) {
                    thumbnailTileEls.eq(i).width(100 / thumbnailTileEls.length + '%').height(75);
                }
            }

            this.focus();
            this._rendered = true;
        };


        GalleryAttachmentListView.prototype.setContent = function (content, opts) {
            opts = opts || {};
            TiledAttachmentListView.prototype.setContent.apply(this, arguments);
            if (opts.attachment) {
                this.setFocusedAttachment(opts.attachment);
            }
            if (this._rendered) {
                this.render();
            }
        };


        /**
         * Appends a new OembedView given an Oembed instance to the view
         * @param oembed {Oembed} A Oembed instance to insert into the view
         * @returns {OembedView} The OembedView associated with the newly inserted oembed
         */
        GalleryAttachmentListView.prototype._insert = function (oembedView) {
            var self = this;
            var stackedAttachmentsEl = this.$el.find(this.stackedAttachmentsSelector);
            var attachmentsGalleryEl = this.$el.find(this.attachmentsGallerySelector);

            if (this.isTileableAttachment(oembedView.oembed)) {
                oembedView.$el.appendTo(attachmentsGalleryEl.find(this.galleryThumbnailsSelector));
                oembedView.$el.on('click', function (e) {
                    /**
                     * Focus content
                     * @event TiledAttachmentListView#focusContent.hub
                     */
                    $(e.target).trigger('focusContent.hub', { content: self.content, attachmentToFocus: oembedView.oembed });
                });
            } else {
                oembedView.$el.appendTo(stackedAttachmentsEl);
            }

            return oembedView;
        };

        /**
         * Add a Oembed attachment to the Attachments view.
         * @param oembed {Oembed} A Oembed instance to render in the View
         * @returns {AttachmentListView} By convention, return this instance for chaining
         */
        GalleryAttachmentListView.prototype.add = function (oembed) {
            // Gallery doesn't display non-tileable attachments (e.g. links)
            if (!this.isTileableAttachment(oembed)) {
                return this;
            }
            var oembedView = TiledAttachmentListView.prototype.add.call(this, oembed);

            this.focus();

            return oembedView;
        };

        /**
         * Displays the focused attachment in the gallery, updates
         * page count/index, and prev/next button visibility.
         * @param oembed {Oembed} A Oembed instance to render in the View
         */
        GalleryAttachmentListView.prototype.focus = function (oembed) {
            if (!oembed && !this.oembedViews.length) {
                return;
            }
            oembed = oembed ? oembed : this._focusedAttachment || this.oembedViews[0].oembed;

            if (!this._focusedAttachment) {
                this.setFocusedAttachment(oembed);
            }

            // Render focused attachment
            var focusedAttachmentsEl = this.$el.find(this.focusedAttachmentsSelector);
            focusedAttachmentsEl.empty();

            var oembedView = new OembedView({ oembed: oembed });
            oembedView.render();
            var focusedEl = oembedView.$el.clone();
            focusedEl.appendTo(focusedAttachmentsEl);

            var photoContentEl = focusedEl.find('.content-attachment-photo');
            photoContentEl.addClass(this.focusedAttachmentClassName);

            if (this._focusedAttachment.type === 'video') {
                var playButtonEl = focusedEl.find('.content-attachment-controls-play');
                playButtonEl.hide();
                photoContentEl.hide().removeClass(this.focusedAttachmentClassName);
                var videoContentEl = focusedEl.find('.content-attachment-video');
                videoContentEl.addClass(this.focusedAttachmentClassName);

                // Instagram videos now display as a native embed. Instead of
                // rendering the video the normal way, let the Sandbox iframe
                // handle the rendering.
                if (this._focusedAttachment.provider_name === 'instagram') {
                    var sandbox = new Sandbox({embed: this._focusedAttachment});
                    videoContentEl.append(sandbox.render().$el);
                } else {
                    videoContentEl.html(this.getAttachmentVideoHtml());
                    var videoIframe = videoContentEl.find('iframe');

                    if (this.tile) {
                        videoIframe.css({ 'width': '100%', 'height': '100%' });
                    }

                    // Add poster if missing
                    var videoEl = videoContentEl.find('video');
                    if (videoEl.length > 0) {
                        videoEl.attr('poster', oembed.thumbnail_url);
                    }

                    // Must attempt to set iframe width/height due to issues surrounding
                    // certain embeds not adjusting correctly to resizing.
                    if (oembed.width && oembed.height) {
                        videoIframe.attr('width', oembed.width);
                        videoIframe.attr('height', oembed.height);
                        videoContentEl.show();
                    } else {
                        oembedView.getAspectRatio(function (aspectRatio) {
                            videoIframe.attr('width', 200 * aspectRatio);
                            videoIframe.attr('height', 200 * (1 / aspectRatio));
                            videoContentEl.show();
                        });
                    }
                }
            }

            // Update page count and focused index
            var attachmentsCount = this.tileableCount();
            if (this.pageCount) {
                var newIndex = 0;
                for (var i = 0; i < this.oembedViews.length; i++) {
                    if (this.oembedViews[i].oembed === this._focusedAttachment) {
                        this.focusedIndex = newIndex;
                        break;
                    }
                    if (this.isTileableAttachment(this.oembedViews[i].oembed)) {
                        newIndex++;
                    }
                }
                this.$el.find(this.galleryCurrentPageSelector).html(this.focusedIndex + 1);
                this.$el.find(this.galleryTotalPagesSelector).html(attachmentsCount);

                var galleryCountEl = this.$el.find(this.galleryCountSelector);

                if (attachmentsCount > 1) {
                    galleryCountEl.show();
                } else {
                    galleryCountEl.hide();
                }
            }

            // Prev/Next buttons
            if (attachmentsCount === 1) {
                this.$el.find(this.galleryPrevSelector).hide();
                this.$el.find(this.galleryNextSelector).hide();
            } else if (this.focusedIndex + 1 === attachmentsCount) {
                this.$el.find(this.galleryPrevSelector).show();
                this.$el.find(this.galleryNextSelector).hide();
            } else if (this.focusedIndex === 0) {
                this.$el.find(this.galleryPrevSelector).hide();
                this.$el.find(this.galleryNextSelector).show();
            } else {
                this.$el.find(this.galleryPrevSelector).show();
                this.$el.find(this.galleryNextSelector).show();
            }

            // Meta
            var contentMetaEl = this.$el.find(this.attachmentMetaSelector);
            var headerView = this._contentHeaderViewFactory.createHeaderView(this.content);
            headerView.setElement(contentMetaEl);
            headerView.render();

            // Update gallery size
            var self = this;
            var focusedAttachmentEl = this.$el.find('.' + this.focusedAttachmentClassName + '> *');
            if (!focusedAttachmentEl.length) {
                return;
            }
            if (focusedAttachmentEl[0].tagName === 'IMG') {
                focusedAttachmentEl.on('load', function (e) {
                    self.resizeFocusedAttachment();
                });
            } else {
                this.resizeFocusedAttachment();
            }
        };

        /**
         * Gets the attachment's video html embed string. If supported, also attach
         * the autoplay query param so that the video will auto-play.
         * @return {string} Attachment's html embed.
         */
        GalleryAttachmentListView.prototype.getAttachmentVideoHtml = function () {
            var attachment = this._focusedAttachment;

            // If the provider is not available for autoplay, nothing more to do.
            if (!attachment.provider_name || !AUTOPLAY_PROVIDER_REGEX.test(attachment.provider_name.toLowerCase())) {
                return attachment.html;
            }

            var $html = $(attachment.html);
            var iframe = $html[0].tagName === 'IFRAME' ? $html[0] : $html.find('iframe')[0];
            var video = $html[0].tagName === 'VIDEO' ? $html[0] : $html.find('video')[0];

            if (video) {
                video.setAttribute('autoplay', true);
                return video.outerHTML;
            }

            if (iframe) {
                var queryChar = iframe.src.indexOf('?') > -1 ? '&' : '?';
                iframe.src += queryChar + 'autoplay=1';

                // make youtube videos not show related videos
                var srcIndex = iframe.src.indexOf('src=');
                var youtubeIndex = iframe.src.indexOf('youtube', srcIndex);
                var nextAmpersand = iframe.src.indexOf('&', srcIndex);
                // youtube is in the source
                if (youtubeIndex < nextAmpersand && srcIndex > -1 && nextAmpersand > -1) {
                    iframe.src = iframe.src.substring(0, nextAmpersand) + '%26rel%3D0' + iframe.src.substring(nextAmpersand);
                }

                return $('<div>').append($html).html();
            }

            return attachment.html;
        };

        /**
         * Resizes the focused attachment to fit within the content view. Sets the
         * direct child of focused attachment to expand to itself.
         */
        GalleryAttachmentListView.prototype.resizeFocusedAttachment = function () {
            // Handles an edge case where there are no views but it gets into this
            // function. Probably coming from a callback.
            if (!this.oembedViews.length) {
                return this.$el.trigger('galleryResize.hub', [1]);
            }

            this.oembedViews[this.focusedIndex].getAspectRatio(function (aspectRatio) {
                this.$el.trigger('galleryResize.hub', [aspectRatio]);
            }.bind(this));
        };

        /**
         * Focuses the next attachment if it is not the last attachment
         */
        GalleryAttachmentListView.prototype.next = function () {
            var tileableIndex = 0;
            for (var i = 0; i < this.oembedViews.length; i++) {
                if (!this.isTileableAttachment(this.oembedViews[i].oembed)) {
                    continue;
                }
                if (this.focusedIndex + 1 === tileableIndex) {
                    this.focusedIndex = tileableIndex;
                    this._focusedAttachment = this.oembedViews[i].oembed;
                    this.render();
                    this.resizeFocusedAttachment();
                    break;
                }
                tileableIndex++;
            }
        };

        /**
         * Focuses the previous attachment if it is not the first attachment
         */
        GalleryAttachmentListView.prototype.prev = function () {
            var tileableIndex = 0;
            for (var i = 0; i < this.oembedViews.length; i++) {
                if (!this.isTileableAttachment(this.oembedViews[i].oembed)) {
                    continue;
                }
                if (this.focusedIndex - 1 === tileableIndex) {
                    this.focusedIndex = tileableIndex;
                    this._focusedAttachment = this.oembedViews[i].oembed;
                    this.render();
                    this.resizeFocusedAttachment();
                    break;
                }
                tileableIndex++;
            }
        };

        return GalleryAttachmentListView;
    });
