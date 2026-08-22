import { parseLinkedInPDF } from '../src/services/linkedin-pdf-parser.js';

describe('Section-aware LinkedIn PDF Parser Fixtures', () => {
  it('correctly parses Profile2 layout', async () => {
    const mockPDFText = `
Contact
asarkar1993@gmail.com
www.linkedin.com/in/anusree-sarkar

Top Skills
Java
Eclipse
IntelliJ IDEA

Certifications
Convolutional Neural Networks
Neural Networks and Deep Learning

Anusree Sarkar
Senior Machine Learning Engineer 1, Adobe DVA ART | Ex-Qualcomm | Ex-Tonbo Imaging | BITS Pilani
Rajasthan, India

Summary
Experienced Senior Machine Learning Engineer with a history of working in the semiconductor industry.

Experience
Adobe
4 years 6 months
Senior Machine Learning Engineer 1
February 2026 - Present (1 month)
Noida
Senior Computer Scientist 1
February 2025 - Present (1 year)
Noida

Education
BITS Pilani
Bachelor of Science
`;

    const result = await parseLinkedInPDF(Buffer.from('mock'), mockPDFText);
    expect(result.name).toBe('Anusree Sarkar');
    expect(result.headline).toContain('Senior Machine Learning Engineer 1');
    expect(result.location).toBe('Rajasthan, India');
    expect(result.email).toBe('asarkar1993@gmail.com');
    expect(result.profileUrl).toContain('linkedin.com/in/anusree-sarkar');
    expect(result.skills).toEqual(['Java', 'Eclipse', 'IntelliJ IDEA']);
    expect(result.certifications).toEqual(['Convolutional Neural Networks', 'Neural Networks and Deep Learning']);
    expect(result.experience.length).toBe(2);
    expect(result.experience[0].company).toBe('Adobe');
    expect(result.experience[0].title).toBe('Senior Machine Learning Engineer 1');
    expect(result.experience[0].dateRange).toBe('February 2026 - Present (1 month)');
    expect(result.education.length).toBe(1);
    expect(result.education[0].institution).toBe('BITS Pilani');
    expect(result.education[0].degree).toBe('Bachelor of Science');
  });

  it('correctly parses Profile3 layout with split email lines', async () => {
    const mockPDFText = `
Contact
agarwal.ashish4296@gmail.co
m
www.linkedin.com/in/ashish-agarwal

Top Skills
Java
React.js
Data Structures

Languages
Hindi
English

Ashish Agarwal
Software Engineer at Adobe
Noida, Uttar Pradesh, India

Summary
Software Engineer with experience building scalable web apps.

Experience
Adobe
4 years 6 months
Senior Computer Scientist 1
February 2025 - Present (1 year)
Noida

Education
National Institute of Technology Durgapur
Bachelor of Technology
`;

    const result = await parseLinkedInPDF(Buffer.from('mock'), mockPDFText);
    expect(result.name).toBe('Ashish Agarwal');
    // Verify email reconstruction works
    expect(result.email).toBe('agarwal.ashish4296@gmail.com');
    expect(result.languages).toEqual(['Hindi', 'English']);
    expect(result.experience[0].company).toBe('Adobe');
    expect(result.experience[0].title).toBe('Senior Computer Scientist 1');
    expect(result.education[0].institution).toBe('National Institute of Technology Durgapur');
  });

  it('correctly parses Profile4 layout', async () => {
    const mockPDFText = `
Contact
gurnoor@uber.com
www.linkedin.com/in/gurnoor-chhabra

Top Skills
Go
Java
Software Development

Certifications
ICPC

Gurnoor Chhabra
SWE @Uber || Ex SWE Intern @Cisco
Jalandhar I, Punjab, India

Summary
Internship Representative CSE'25

Experience
Uber
Software Engineer
August 2025 - Present
Jalandhar
Cisco
Software Engineering Intern
May 2024 - June 2024
Bengaluru

Education
Dr B R Ambedkar National Institute of Technology, Jalandhar
Bachelor of Technology - BTech
Computer Science
2021 - 2025
`;

    const result = await parseLinkedInPDF(Buffer.from('mock'), mockPDFText);
    expect(result.name).toBe('Gurnoor Chhabra');
    expect(result.skills).toEqual(['Go', 'Java', 'Software Development']);
    expect(result.certifications).toEqual(['ICPC']);
    expect(result.experience.length).toBe(2);
    expect(result.experience[0].company).toBe('Uber');
    expect(result.experience[1].company).toBe('Cisco');
    expect(result.education[0].institution).toBe('Dr B R Ambedkar National Institute of Technology, Jalandhar');
    expect(result.education[0].startYear).toBe('2021');
    expect(result.education[0].endYear).toBe('2025');
  });
});
