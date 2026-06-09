type GuideCopy = {
  steps: string[];
  doNot: string[];
};

export const guideCopy: Record<string, GuideCopy> = {
  "document-title": {
    steps: ["Type the title.", "Select the title.", "Open the Styles dropdown.", "Click Title.", "Use the toolbar font, size, bold, and text color buttons."],
    doNot: ["Do not recreate the title as an image.", "Do not use blank lines to position it.", "Do not use enlarged Normal text when Title fits."],
  },
  "section-heading": {
    steps: ["Type the heading.", "Select the heading.", "Open the Styles dropdown.", "Click Heading 1, Heading 2, or Heading 3.", "Use toolbar font, size, bold, and text color buttons."],
    doNot: ["Do not make headings with only bold text.", "Do not skip heading styles for section titles.", "Do not screenshot heading text."],
  },
  "paragraph-text": {
    steps: ["Type the paragraph.", "Select the paragraph.", "Open the Styles dropdown.", "Click Normal text.", "Use Align, Line spacing, and Increase indent buttons."],
    doNot: ["Do not paste body text as an image.", "Do not align text with repeated spaces.", "Do not use blank lines for paragraph spacing."],
  },
  "highlighted-text": {
    steps: ["Type the text.", "Select the highlighted words.", "Click Highlight color.", "Choose the closest color.", "Change text color too only if the source also changes text color."],
    doNot: ["Do not draw a rectangle behind the text.", "Do not screenshot highlighted text.", "Do not highlight extra words."],
  },
  "underlined-strikethrough": {
    steps: ["Type the text.", "Select the styled words.", "Click Underline on the toolbar.", "Use Format → Text → Strikethrough.", "Check only the source words are styled."],
    doNot: ["Do not draw lines over text.", "Do not screenshot styled text.", "Do not treat a link underline as plain underline."],
  },
  "small-note-text": {
    steps: ["Type the note.", "Select the note.", "Use the Font size box.", "Click Align or Line spacing if needed.", "Use Insert → Footnote for a footnote marker."],
    doNot: ["Do not screenshot fine print.", "Do not make note text unreadable.", "Do not manually type footnote numbers when Footnote fits."],
  },
  "plain-table": {
    steps: ["Count the rows and columns.", "Use Insert → Table.", "Select the matching grid size.", "Enter the cell text.", "Use Format → Table → Table properties."],
    doNot: ["Do not screenshot the table.", "Do not use spaces to fake columns.", "Do not paste table text into one paragraph."],
  },
  "styled-header-table": {
    steps: ["Use Insert → Table.", "Select the matching grid size.", "Select the header row.", "Click Background color.", "Use Bold, Align, and Table properties."],
    doNot: ["Do not screenshot the table.", "Do not paste the table as an image.", "Do not use spaces to fake columns."],
  },
  "merged-cell-table": {
    steps: ["Use Insert → Table.", "Select the full grid size.", "Select the cells to combine.", "Use Format → Table → Merge cells.", "Use Table properties for borders and alignment."],
    doNot: ["Do not fake merged cells with text boxes.", "Do not screenshot the table.", "Do not delete cells to simplify the layout."],
  },
  "borderless-layout-table": {
    steps: ["Use Insert → Table.", "Place content in the cells.", "Open Format → Table → Table properties.", "Set Table border to 0 pt.", "Set Cell padding and column widths."],
    doNot: ["Do not align blocks with spaces.", "Do not screenshot editable text.", "Do not use a layout table for normal paragraphs."],
  },
  "shaded-cell-table": {
    steps: ["Use Insert → Table.", "Select the shaded cells.", "Click Background color.", "Choose the closest color.", "Use Table properties for borders and padding."],
    doNot: ["Do not draw colored boxes over cells.", "Do not screenshot the table.", "Do not use text highlight for whole-cell shading."],
  },
  "long-table-repeating-header": {
    steps: ["Use Insert → Table.", "Enter rows in one table.", "Select the header row.", "Open Format → Table → Table properties.", "Use Row options for header behavior."],
    doNot: ["Do not split one table into screenshots.", "Do not create separate tables unless the source does.", "Do not force page flow with blank lines."],
  },
  "simple-bar-column-chart": {
    steps: ["Use Insert → Chart → Bar or Column.", "Click the chart Link options menu.", "Click Open source.", "Edit the data table in Sheets.", "Use Chart editor → Customize for title, legend, axes, and colors."],
    doNot: ["Do not screenshot a chart that should be recreated.", "Do not draw bars manually.", "Do not omit labels or legends."],
  },
  "pie-chart": {
    steps: ["Use Insert → Chart → Pie.", "Click the chart Link options menu.", "Click Open source.", "Edit labels and values in Sheets.", "Use Chart editor → Customize for legend, slices, and colors."],
    doNot: ["Do not paste a screenshot when a chart can be recreated.", "Do not hand-draw slices.", "Do not omit the legend when it matters."],
  },
  "line-chart": {
    steps: ["Use Insert → Chart → Line.", "Click the chart Link options menu.", "Click Open source.", "Edit the series data in Sheets.", "Use Chart editor → Customize for axes, legend, and line colors."],
    doNot: ["Do not draw line charts manually.", "Do not screenshot a recreatable chart.", "Do not remove a data series."],
  },
  "combo-chart-secondary-axis": {
    steps: ["Use Insert → Chart.", "Click the chart Link options menu.", "Click Open source.", "Use Chart editor → Setup → Chart type → Combo chart.", "Use Customize → Series → Axis for the secondary axis."],
    doNot: ["Do not fake a second axis with text boxes.", "Do not draw chart parts manually.", "Do not remove a series to simplify the chart."],
  },
  flowchart: {
    steps: ["Use Insert → Drawing → New.", "Click Shape for boxes or diamonds.", "Click Line → Arrow for connectors.", "Click Text box for labels.", "Click Save and close."],
    doNot: ["Do not screenshot editable flowcharts.", "Do not build it with loose text boxes on the page.", "Do not omit arrows."],
  },
  "shape-diagram": {
    steps: ["Use Insert → Drawing → New.", "Click Shape.", "Click Text box for labels.", "Click Line or Arrow if needed.", "Click Save and close."],
    doNot: ["Do not flatten editable diagrams into images.", "Do not align shapes with spaces.", "Do not use external artwork unless the source requires it."],
  },
  "timeline-diagram": {
    steps: ["Use Insert → Drawing → New.", "Click Line for the timeline.", "Click Shape for milestone markers.", "Click Text box for dates.", "Click Save and close."],
    doNot: ["Do not align dates with spaces.", "Do not screenshot a recreatable timeline.", "Do not change date order."],
  },
  "process-diagram": {
    steps: ["Use Insert → Drawing → New.", "Click Shape for each step.", "Click Text box for labels.", "Click Line → Arrow for flow.", "Click Save and close."],
    doNot: ["Do not screenshot editable process text.", "Do not use unrelated icons.", "Do not align steps with spaces."],
  },
  "photo-scan": {
    steps: ["Use Insert → Image.", "Choose Upload from computer, Drive, Photos, URL, Camera, or Search the web.", "Click the image.", "Click Image options.", "Use Wrap text, Break text, or In line."],
    doNot: ["Do not use images for editable text.", "Do not stretch the image.", "Do not crop important content."],
  },
  logo: {
    steps: ["Use Insert → Image.", "Choose the logo source.", "Click the logo.", "Click Image options.", "Use Wrap text, Break text, or In line."],
    doNot: ["Do not invent or redesign logos.", "Do not stretch the logo.", "Do not recolor a logo unless the source does."],
  },
  "image-caption": {
    steps: ["Use Insert → Image.", "Click the image.", "Click Image options.", "Use Wrap text or Break text.", "Type the caption below the image.", "Use Styles or toolbar text buttons for caption styling."],
    doNot: ["Do not include editable caption text inside an image.", "Do not leave the caption floating far from the image.", "Do not stretch the image."],
  },
  "inline-icon": {
    steps: ["Use Insert → Image for an icon.", "Use Insert → Special characters for a symbol.", "Click the icon.", "Click Image options.", "Use In line when it sits with text."],
    doNot: ["Do not screenshot a full line just for an icon.", "Do not replace meaningful icons with unrelated symbols.", "Do not make icons inconsistent in size."],
  },
  header: {
    steps: ["Use Insert → Headers & footers → Header.", "Type the header content.", "Use Insert → Image if needed.", "Click Different first page if needed.", "Click Options for header settings."],
    doNot: ["Do not type the header manually on every page.", "Do not place header content in the body.", "Do not use blank lines to make room."],
  },
  footer: {
    steps: ["Use Insert → Headers & footers → Footer.", "Type the footer content.", "Use Insert → Page numbers if needed.", "Click Align for left, center, or right.", "Click Options for footer settings."],
    doNot: ["Do not type footer content on every page.", "Do not place footer content in the body.", "Do not use blank lines to make room."],
  },
  "page-number": {
    steps: ["Use Insert → Page numbers.", "Choose the matching page-number layout.", "Use Insert → Page numbers → More options if needed.", "Set Apply to and Numbering.", "Click Apply."],
    doNot: ["Do not type page numbers manually.", "Do not place page numbers in body text.", "Do not number pages with text boxes."],
  },
  footnote: {
    steps: ["Place the cursor after the referenced text.", "Use Insert → Footnote.", "Type the footnote text.", "Use the toolbar text buttons for styling.", "Repeat in source order."],
    doNot: ["Do not manually type footnote numbers.", "Do not use footer text as a footnote.", "Do not screenshot footnotes."],
  },
  "table-of-contents": {
    steps: ["Apply Heading styles first.", "Place the cursor where the contents should go.", "Use Insert → Table of contents.", "Choose With page numbers or With blue links.", "Click Refresh after edits."],
    doNot: ["Do not type a contents list manually when generated contents fit.", "Do not fake dot leaders with periods.", "Do not build it from unstyled headings."],
  },
  watermark: {
    steps: ["Use Insert → Watermark.", "Choose Image or Text.", "Set scale or formatting.", "Set transparency if needed.", "Click Done."],
    doNot: ["Do not paste a faded image on every page.", "Do not add a watermark that is not in the source.", "Do not cover readable content."],
  },
  "page-break": {
    steps: ["Place the cursor before the new page content.", "Use Insert → Break → Page break.", "Delete extra blank lines.", "Use View → Print layout to check the page break."],
    doNot: ["Do not press Enter repeatedly.", "Do not use blank tables as spacers.", "Do not manually push every page down."],
  },
  "section-break": {
    steps: ["Place the cursor before the layout change.", "Use Insert → Break → Section break.", "Use File → Page setup for section layout.", "Use Format → Columns if needed.", "Use Header/Footer Options for section headers."],
    doNot: ["Do not fake section changes with blank lines.", "Do not change the whole document if only one section differs.", "Do not retype repeated page elements manually."],
  },
  "two-column-layout": {
    steps: ["Select the column text.", "Use Format → Columns.", "Choose the two-column icon.", "Use Format → Columns → More options for spacing.", "Use Insert → Table for fixed side-by-side blocks."],
    doNot: ["Do not align columns with spaces.", "Do not screenshot editable columns.", "Do not mix columns and tables without a reason."],
  },
  "horizontal-divider": {
    steps: ["Place the cursor where the divider belongs.", "Use Insert → Horizontal line.", "Use Format → Paragraph styles → Borders and shading for custom lines.", "Set Position, Border width, and Border color.", "Click Apply."],
    doNot: ["Do not type repeated hyphens.", "Do not draw a floating line unless necessary.", "Do not screenshot a simple divider."],
  },
  "large-spacing": {
    steps: ["Use Format → Line & paragraph spacing.", "Click Custom spacing if exact spacing is needed.", "Use the Increase indent button.", "Use Insert → Break for page breaks.", "Use Table properties for layout padding."],
    doNot: ["Do not press Enter repeatedly.", "Do not use long runs of spaces.", "Do not chase exact spacing with fragile layout tricks."],
  },
  hyperlink: {
    steps: ["Select the link text.", "Use Insert → Link or Ctrl+K.", "Enter the URL or destination.", "Click Apply.", "Click the linked text once to verify it."],
    doNot: ["Do not leave source links unclickable.", "Do not screenshot URLs.", "Do not invent hidden link targets."],
  },
  "bookmark-internal-jump": {
    steps: ["Place the cursor at the destination.", "Use Insert → Bookmark.", "Select the jump text.", "Use Insert → Link.", "Choose Bookmarks, then click the bookmark."],
    doNot: ["Do not use an external URL for an internal jump.", "Do not leave jump text unlinked.", "Do not create a bookmark in the wrong section."],
  },
  "citation-bibliography": {
    steps: ["Use Tools → Citations for structured citations.", "Click Add citation source.", "Fill the source fields.", "Click Cite for in-text citations.", "Click Insert bibliography if needed."],
    doNot: ["Do not invent source details.", "Do not screenshot reference lists.", "Do not change dates, names, or titles."],
  },
  "special-character": {
    steps: ["Place the cursor.", "Use Insert → Special characters.", "Search or draw the symbol.", "Click the matching character.", "Use the toolbar Font size box if needed."],
    doNot: ["Do not use a screenshot of a symbol.", "Do not use a lookalike character.", "Do not flatten surrounding text."],
  },
  equation: {
    steps: ["Place the cursor.", "Use Insert → Equation.", "Use the New equation toolbar.", "Click math symbols, fractions, or exponents.", "Check every symbol against the source."],
    doNot: ["Do not screenshot equations that can be rebuilt.", "Do not approximate formulas with unclear text.", "Do not change the math."],
  },
};
