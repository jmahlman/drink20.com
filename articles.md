---
layout: page
title: Archive
description: Every Drink20 post, newest first.
wide: true
---

<ul class="post-list">
	{%- for post in site.posts -%}
	<li class="post-card">
		{%- if post.image -%}
		<div class="post-card__media">
			<img src="{{ post.image | prepend: '/assets/img/' | relative_url }}" alt="" loading="lazy" />
		</div>
		{%- endif -%}
		<div class="post-card__body">
			<p class="post-card__meta">
				<time datetime="{{ post.date | date_to_xmlschema }}">
					{{ post.date | date: '%b %-d, %Y' }}
				</time>
				{%- if post.author -%}<span class="dot">{{ post.author }}</span>{%- endif -%}
			</p>
			<h2 class="post-card__title">
				<a href="{{ post.url | relative_url }}">{{ post.title }}</a>
			</h2>
			<p class="post-card__excerpt">
				{{ post.description | default: post.excerpt | strip_html | truncate: 130 }}
			</p>
		</div>
	</li>
	{%- endfor -%}
</ul>
