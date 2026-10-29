using GorevPanosu.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace GorevPanosu.Api.Migrations;

[DbContext(typeof(AppDbContext))]
public sealed class AppDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "8.0.24");
        modelBuilder.Entity("GorevPanosu.Api.Data.Person", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            entity.Property<string>("FullName").IsRequired().HasColumnType("text");
            entity.Property<bool>("IsActive").HasColumnType("boolean");
            entity.HasKey("Id");
            entity.ToTable("People");
        });
        modelBuilder.Entity("GorevPanosu.Api.Data.TaskItem", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("uuid");
            entity.Property<Guid?>("AssigneeId").HasColumnType("uuid");
            entity.Property<DateTime?>("CompletedAt").HasColumnType("timestamp with time zone");
            entity.Property<DateTime>("CreatedAt").HasColumnType("timestamp with time zone");
            entity.Property<string>("Description").HasColumnType("text");
            entity.Property<DateOnly?>("DueDate").HasColumnType("date");
            entity.Property<string>("Status").IsRequired().HasMaxLength(16).HasColumnType("character varying(16)");
            entity.Property<string>("Title").IsRequired().HasMaxLength(120).HasColumnType("character varying(120)");
            entity.HasKey("Id");
            entity.HasIndex("AssigneeId");
            entity.ToTable("Tasks");
        });
        modelBuilder.Entity("GorevPanosu.Api.Data.TaskItem", entity =>
        {
            entity.HasOne("GorevPanosu.Api.Data.Person", "Assignee").WithMany()
                .HasForeignKey("AssigneeId").OnDelete(DeleteBehavior.Restrict);
            entity.Navigation("Assignee");
        });
    }
}
