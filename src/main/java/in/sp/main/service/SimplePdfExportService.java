package in.sp.main.service;

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Generates clean, valid multi-page PDF 1.4 documents in pure Java for Casting Company reports.
 */
@Service
public class SimplePdfExportService {

    public byte[] generateReportPdf(String title, List<String> lines) {
        List<List<String>> pages = new ArrayList<>();
        int linesPerPage = 44;
        for (int i = 0; i < lines.size(); i += linesPerPage) {
            pages.add(lines.subList(i, Math.min(lines.size(), i + linesPerPage)));
        }
        if (pages.isEmpty()) {
            pages.add(List.of("No records available."));
        }

        List<byte[]> objects = new ArrayList<>();
        // 1: Catalog, 2: Pages, 3: Font Helvetica, 4: Font Helvetica-Bold
        objects.add("<< /Type /Catalog /Pages 2 0 R >>".getBytes(StandardCharsets.US_ASCII));
        StringBuilder kids = new StringBuilder();
        int nextId = 5;
        List<Integer> pageIds = new ArrayList<>();
        for (int i = 0; i < pages.size(); i++) {
            pageIds.add(nextId);
            kids.append(nextId).append(" 0 R ");
            nextId += 2; // page + content stream
        }
        objects.add(("<< /Type /Pages /Kids [ " + kids + "] /Count " + pages.size() + " >>").getBytes(StandardCharsets.US_ASCII));
        objects.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".getBytes(StandardCharsets.US_ASCII));
        objects.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>".getBytes(StandardCharsets.US_ASCII));

        for (int p = 0; p < pages.size(); p++) {
            int pageId = pageIds.get(p);
            int contentId = pageId + 1;
            String pageDict = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
                    + "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + contentId + " 0 R >>";
            objects.add(pageDict.getBytes(StandardCharsets.US_ASCII));

            StringBuilder stream = new StringBuilder();
            stream.append("BT\n");
            stream.append("/F2 15 Tf 42 798 Td (").append(escapePdf(title)).append(") Tj\n");
            stream.append("/F1 9 Tf 0 -16 Td (Page ").append(p + 1).append(" of ").append(pages.size())
                  .append("  |  Entertainment World Casting Reports) Tj\n");
            stream.append("/F1 10 Tf 0 -22 Td\n");
            for (String line : pages.get(p)) {
                stream.append("(").append(escapePdf(line)).append(") Tj 0 -15 Td\n");
            }
            stream.append("ET\n");
            byte[] streamBytes = stream.toString().getBytes(StandardCharsets.US_ASCII);
            String header = "<< /Length " + streamBytes.length + " >>\nstream\n";
            String footer = "\nendstream";
            ByteArrayOutputStream objOut = new ByteArrayOutputStream();
            objOut.writeBytes(header.getBytes(StandardCharsets.US_ASCII));
            objOut.writeBytes(streamBytes);
            objOut.writeBytes(footer.getBytes(StandardCharsets.US_ASCII));
            objects.add(objOut.toByteArray());
        }

        ByteArrayOutputStream pdf = new ByteArrayOutputStream();
        pdf.writeBytes("%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII));
        List<Integer> offsets = new ArrayList<>();
        for (int i = 0; i < objects.size(); i++) {
            offsets.add(pdf.size());
            pdf.writeBytes(((i + 1) + " 0 obj\n").getBytes(StandardCharsets.US_ASCII));
            pdf.writeBytes(objects.get(i));
            pdf.writeBytes("\nendobj\n".getBytes(StandardCharsets.US_ASCII));
        }
        int xrefPos = pdf.size();
        pdf.writeBytes(("xref\n0 " + (objects.size() + 1) + "\n0000000000 65535 f \n").getBytes(StandardCharsets.US_ASCII));
        for (int off : offsets) {
            pdf.writeBytes(String.format("%010d 00000 n \n", off).getBytes(StandardCharsets.US_ASCII));
        }
        pdf.writeBytes(("trailer\n<< /Size " + (objects.size() + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF").getBytes(StandardCharsets.US_ASCII));
        return pdf.toByteArray();
    }

    private String escapePdf(String text) {
        if (text == null) return "";
        String ascii = text.replace("₹", "Rs.").replaceAll("[^\\x20-\\x7E]", " ");
        return ascii.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)");
    }
}
