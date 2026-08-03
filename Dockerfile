# Matches the Ruby version used by .github/workflows/jekyll.yml so local
# builds and the GitHub Pages build stay in sync.
FROM ruby:3.2

WORKDIR /site

# Install gems in their own layer so editing content/styles doesn't re-bundle.
COPY Gemfile Gemfile.lock ./
RUN bundle install

EXPOSE 4000

# --livereload is deliberately omitted: the `http_parser` gem in the Gemfile
# shadows the `http_parser.rb` that em-websocket needs, so the livereload
# reactor crashes on connect. Rebuilds still happen on save — just reload the
# page yourself.
CMD ["bundle", "exec", "jekyll", "serve", \
     "--host", "0.0.0.0", \
     "--force_polling"]
