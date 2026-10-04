import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAll() {
    const students = await this.prisma.students.findMany({
        include: {
        persons: true,
        },
    });

    return students.map((student) => ({
        id: student.id,
        studentCode: student.student_code,
        documentNumber: student.persons.document_number,
        fullName: [
        student.persons.first_name,
        student.persons.last_name_father,
        student.persons.last_name_mother,
        ].join(' '),
        birthDate: student.persons.birth_date,
        isActive: student.is_active,
    }));
    }

    async findById(id: string) {
        return this.prisma.students.findUnique({
            where: {
            id,
            },
            include: {
            persons: true,
            },
        });
    }

    async create(
        createStudentDto: CreateStudentDto,
    ) {

        const totalStudents =
            await this.prisma.students.count();

        const studentCode =
            `STU${String(totalStudents + 1).padStart(4, '0')}`;

        const person =
            await this.prisma.persons.create({
            data: {
                document_type:
                createStudentDto.documentType,

                document_number:
                createStudentDto.documentNumber,

                first_name:
                createStudentDto.firstName,

                last_name_father:
                createStudentDto.lastNameFather,

                last_name_mother:
                createStudentDto.lastNameMother,

                birth_date:
                new Date(
                    createStudentDto.birthDate,
                ),

                is_active: true,
            },
            });

        return this.prisma.students.create({
            data: {
            person_id: person.id,
            student_code: studentCode,
            is_active: true,
            },
            include: {
            persons: true,
            },
        });
    }
}