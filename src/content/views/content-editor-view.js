var inherits = require('inherits');
var Auth = require('auth');
var View = require('streamhub-sdk/view');
var EditorView = require('streamhub-editor/auth-editor');
var template = require('hgn!streamhub-sdk/content/templates/content-editor');

'use strict';

var ContentEditorView = function (opts) {
    opts = opts || {};
    this._content = opts.content;
    this._editorView = opts.editorView || new EditorView(opts);

    View.call(this, opts);
};
inherits(ContentEditorView, View);

ContentEditorView.prototype.elClass = 'content-editor';
ContentEditorView.prototype.template = template;
ContentEditorView.prototype.avatarClass = 'content-editor-avatar';
ContentEditorView.prototype.inputClass = 'content-editor-input';

ContentEditorView.prototype.events = View.prototype.events.extended({
    'writeContent.hub': '_writeContent'
});

ContentEditorView.prototype._writeContent = function (e, content) {
    content.parentId = this._content.id;
    this._content.collection.write(content, this._handleWrite.bind(this));
};

ContentEditorView.prototype._handleWrite = function (err, data) {
    if (err) {
        this.$el.trigger('writeFail.hub');
        return;
    }
    this.$el.trigger('writeSuccess.hub');
};

ContentEditorView.prototype.setElement = function (el) {
    View.prototype.setElement.call(this, el);
};

ContentEditorView.prototype.render = function () {
    View.prototype.render.call(this);
    this.$el.find('.'+this.inputClass).append(this._editorView.el);
    this._editorView.render();
};

ContentEditorView.prototype.getTemplateContext = function () {
    var context = View.prototype.getTemplateContext.call(this);
    var user = Auth.get('livefyre');
    if (user) {
        context.avatarUrl = user.get('avatar');
    }
    return context;
};

module.exports = ContentEditorView;
